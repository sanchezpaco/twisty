"""Compact routing graph: junctions as nodes, road stretches between them as edges, one-way ones ridden from -> to."""

from collections import deque
from dataclasses import dataclass
from enum import IntFlag

import numpy as np

from .chains import CurveFun, way_key
from .curvature import cumulative_fun_m, turning_profile, vertex_density
from .geo import hilbert_index, project_to_meters, simplify_indices
from .roads import POSTED_MAX_KMH, OneWay, RoadClass, Way, cumulative_time_s, fun_weight, road_label, travel_speed_kmh

# Edge geometry is only drawn on screen, so a coarse tolerance keeps the file small.
GEOMETRY_TOLERANCE_M = 15.0
# Drops fragments a rider cannot get in and out of (mapping errors, private estates, one-way traps) that the planner
# could snap to: only strongly connected components this large are kept.
MIN_COMPONENT_NODES = 500
# An edge's heading at each end is read this far along it, so that the last few metres of a way do not decide it. The
# planner bans a U-turn from one one-way edge onto another (one carriageway onto the other where a road divides).
HEADING_SPAN_M = 15.0
# Headings are stored in 1/256 of a turn.
HEADING_STEPS = 256


class EdgeFlag(IntFlag):
    """What the rider is told, or the planner weighs, about an edge; bits 3-7 are free."""

    CLOSED_PART_OF_YEAR = 1  # a conditional restriction closes it to motor traffic part of the year
    DESTINATION_ONLY = 2  # open only to those with business there
    BUILT_UP = 4  # most of its length is in a town (see Way.built_up)


# Edges of one road merge across these only where they agree: a closure or a private lane holds for the whole edge.
SPLITTING_FLAGS = EdgeFlag.CLOSED_PART_OF_YEAR | EdgeFlag.DESTINATION_ONLY


def access_flags(way: Way) -> int:
    return (EdgeFlag.CLOSED_PART_OF_YEAR if way.closed_part_of_year else 0) | (EdgeFlag.DESTINATION_ONLY if way.destination_only else 0)


@dataclass(frozen=True)
class RoutingGraph:
    """A road network, or a layer stacked on one: then its node and road indices continue the base's."""

    node_ids: np.ndarray  # int64 (N,), OSM ids
    node_lonlat: np.ndarray  # float64 (N, 2)
    edge_from: np.ndarray  # int64 (E,)
    edge_to: np.ndarray  # int64 (E,)
    edge_time_s: np.ndarray  # float64 (E,)
    edge_length_m: np.ndarray  # float64 (E,)
    edge_fun_m: np.ndarray  # float64 (E,), fun-weighted length (see curvature.cumulative_fun_m)
    edge_class: np.ndarray  # uint8 (E,)
    edge_narrow: np.ndarray  # uint8 (E,), share of the edge's length on narrow ways, 0..255
    edge_posted_kmh: np.ndarray  # uint8 (E,), lowest posted limit of at most POSTED_MAX_KMH on the edge, 0 for none
    edge_fords: np.ndarray  # uint8 (E,), ford nodes on the edge, at most 255
    edge_oneway: np.ndarray  # uint8 (E,), OneWay: YES is ridden only from edge_from to edge_to
    edge_heading: np.ndarray  # uint8 (E, 2), riding from -> to: the heading leaving edge_from and arriving at edge_to
    edge_flags: np.ndarray  # uint8 (E,), EdgeFlag bits
    edge_road: np.ndarray  # int64 (E,), index into road_names
    edge_geometry: list[np.ndarray]  # intermediate (lon, lat) points, oriented from -> to
    road_names: list[str]


@dataclass(slots=True)
class _Edge:
    a: int
    b: int
    time_s: float
    length_m: float
    fun_m: float
    road_class: int
    road: int
    geometry: np.ndarray
    narrow_m: float = 0.0
    posted_kmh: float = np.inf
    fords: int = 0
    oneway: OneWay = OneWay.NO
    access: int = 0  # SPLITTING_FLAGS bits
    built_up_m: float = 0.0
    alive: bool = True

    def other_end(self, node: int) -> int:
        return self.b if self.a == node else self.a

    def geometry_from(self, node: int) -> np.ndarray:
        return self.geometry if self.a == node else self.geometry[::-1]


def _posted_kmh(way: Way) -> float:
    limit = way.maxspeed_kmh
    return limit if limit is not None and limit <= POSTED_MAX_KMH else np.inf


def junction_node_ids(ways: list[Way]) -> np.ndarray:
    """Sorted OSM ids of nodes shared by several ways or ending a way."""
    all_ids = np.concatenate([way.node_ids for way in ways])
    unique, counts = np.unique(all_ids, return_counts=True)
    endpoints = np.array([way.node_ids[i] for way in ways for i in (0, -1)], dtype=np.int64)
    return np.union1d(unique[counts >= 2], endpoints)


def build_graph(ways: list[Way], junction_ids: np.ndarray, curve_fun: CurveFun | None = None) -> RoutingGraph:
    builder = _GraphBuilder(junction_ids, curve_fun or {})
    for way in ways:
        builder.add_way(way)
    builder.contract()
    return builder.finish()


def build_layers(ways: list[Way], curve_fun: CurveFun | None = None) -> tuple[RoutingGraph, RoutingGraph]:
    """The paved road network, and a tracks layer stacked on it that the app only loads on request. `curve_fun` gives
    the chained ways their curve fun along the road (chains.curve_fun_by_way); the others take their own.

    The road network is built on its own so that riders who never include tracks do not pay for the
    junctions tracks would add to it.
    """
    paved = [way for way in ways if way.road_class != RoadClass.TRACK]
    roads = renumbered(build_graph(paved, junction_node_ids(paved), curve_fun))
    layer = stacked_layer(roads, build_graph(ways, junction_node_ids(ways), curve_fun))
    return roads, renumbered(layer, first_node=len(roads.node_ids))


def renumbered(graph: RoutingGraph, first_node: int = 0) -> RoutingGraph:
    """The same graph with nodes numbered along a Hilbert curve and edges ordered by their first node.

    A search jumps from a node to its neighbours and reads their edges: with neighbours numbered next to each
    other it walks through memory instead of leaping across it, which is about a third faster. A stacked layer
    holds only its own nodes, numbered from `first_node` on; the base nodes its edges reach keep their numbers.
    """
    curve_order = np.argsort(hilbert_index(graph.node_lonlat), kind="stable")
    new_local = np.empty(len(curve_order), dtype=np.int64)
    new_local[curve_order] = np.arange(len(curve_order))

    def renumber(nodes: np.ndarray) -> np.ndarray:
        return np.where(nodes < first_node, nodes, first_node + new_local[np.maximum(nodes - first_node, 0)])

    edge_from, edge_to = renumber(graph.edge_from), renumber(graph.edge_to)
    edge_order = np.argsort(np.minimum(edge_from, edge_to), kind="stable")
    return RoutingGraph(
        node_ids=graph.node_ids[curve_order],
        node_lonlat=graph.node_lonlat[curve_order],
        edge_from=edge_from[edge_order],
        edge_to=edge_to[edge_order],
        edge_time_s=graph.edge_time_s[edge_order],
        edge_length_m=graph.edge_length_m[edge_order],
        edge_fun_m=graph.edge_fun_m[edge_order],
        edge_class=graph.edge_class[edge_order],
        edge_narrow=graph.edge_narrow[edge_order],
        edge_posted_kmh=graph.edge_posted_kmh[edge_order],
        edge_fords=graph.edge_fords[edge_order],
        edge_oneway=graph.edge_oneway[edge_order],
        edge_heading=graph.edge_heading[edge_order],
        edge_flags=graph.edge_flags[edge_order],
        edge_road=graph.edge_road[edge_order],
        edge_geometry=[graph.edge_geometry[edge] for edge in edge_order],
        road_names=graph.road_names,
    )


def stacked_layer(base: RoutingGraph, full: RoutingGraph) -> RoutingGraph:
    """What `full` adds to `base`: its tracks, plus the road stretches split where tracks join them.

    Split stretches duplicate a base edge in pieces; both ride the same road in the same time, so
    searches may take either.
    """
    in_base = np.isin(full.node_ids, base.node_ids)
    new_nodes = np.flatnonzero(~in_base)
    index = np.empty(len(full.node_ids), dtype=np.int64)
    base_order = np.argsort(base.node_ids)
    index[in_base] = base_order[np.searchsorted(base.node_ids[base_order], full.node_ids[in_base])]
    index[new_nodes] = len(base.node_ids) + np.arange(len(new_nodes))
    is_track = full.edge_class == RoadClass.TRACK
    edges = np.flatnonzero(is_track | ~(in_base[full.edge_from] & in_base[full.edge_to]))

    road_index = {name: i for i, name in enumerate(base.road_names)}
    new_names: list[str] = []
    for name in dict.fromkeys(full.road_names[road] for road in full.edge_road[edges]):
        if name not in road_index:
            road_index[name] = len(road_index)
            new_names.append(name)
    return RoutingGraph(
        node_ids=full.node_ids[new_nodes],
        node_lonlat=full.node_lonlat[new_nodes],
        edge_from=index[full.edge_from[edges]],
        edge_to=index[full.edge_to[edges]],
        edge_time_s=full.edge_time_s[edges],
        edge_length_m=full.edge_length_m[edges],
        edge_fun_m=full.edge_fun_m[edges],
        edge_class=full.edge_class[edges],
        edge_narrow=full.edge_narrow[edges],
        edge_posted_kmh=full.edge_posted_kmh[edges],
        edge_fords=full.edge_fords[edges],
        edge_oneway=full.edge_oneway[edges],
        edge_heading=full.edge_heading[edges],
        edge_flags=full.edge_flags[edges],
        edge_road=np.array([road_index[full.road_names[road]] for road in full.edge_road[edges]], dtype=np.int64),
        edge_geometry=[full.edge_geometry[edge] for edge in edges],
        road_names=new_names,
    )


class _GraphBuilder:
    def __init__(self, junction_ids: np.ndarray, curve_fun: CurveFun):
        self.junction_ids = junction_ids
        self.curve_fun = curve_fun
        self.node_lonlat = np.zeros((len(junction_ids), 2))
        self.edges: list[_Edge] = []
        self.road_index: dict[str, int] = {"": 0}
        self.counted_fords: set[int] = set()

    def add_way(self, way: Way) -> None:
        indices = np.searchsorted(self.junction_ids, way.node_ids)
        positions = np.flatnonzero(self.junction_ids[np.minimum(indices, len(self.junction_ids) - 1)] == way.node_ids)
        self.node_lonlat[indices[positions]] = way.lonlat[positions]
        profile = turning_profile(way.lonlat)
        fun_m = cumulative_fun_m(profile, self.curve_fun.get(way_key(way))) * fun_weight(way)
        road = self.road_index.setdefault(road_label(way), len(self.road_index))
        time_s = cumulative_time_s(profile.distance_m, travel_speed_kmh(way.road_class, way.maxspeed_kmh, vertex_density(profile)))
        for start, end in zip(positions[:-1], positions[1:]):
            length = profile.distance_m[end] - profile.distance_m[start]
            if length <= 0:
                continue
            self.edges.append(
                _Edge(
                    a=int(indices[start]),
                    b=int(indices[end]),
                    time_s=float(time_s[end] - time_s[start]),
                    length_m=length,
                    fun_m=fun_m[end] - fun_m[start],
                    road_class=int(way.road_class),
                    road=road,
                    geometry=way.lonlat[start + 1 : end],
                    narrow_m=length if way.narrow else 0.0,
                    posted_kmh=_posted_kmh(way),
                    fords=self._count_fords(way, start, end),
                    oneway=way.oneway,
                    access=access_flags(way),
                    built_up_m=length if way.built_up else 0.0,
                )
            )

    def _count_fords(self, way: Way, start: int, end: int) -> int:
        """The fords at vertices start (first edge only) to end of the way; a ford node where two ways meet counts once."""
        found = {
            int(way.node_ids[ford]) for ford in way.ford_positions if start < ford <= end or ford == start == 0
        } - self.counted_fords
        self.counted_fords |= found
        return len(found)

    def contract(self) -> None:
        """Merge edge pairs through nodes that only continue the same road, the same way round."""
        incident: list[set[int]] = [set() for _ in range(len(self.junction_ids))]
        for index, edge in enumerate(self.edges):
            incident[edge.a].add(index)
            incident[edge.b].add(index)
        for node in range(len(incident)):
            if len(incident[node]) != 2:
                continue
            first_index, second_index = incident[node]
            first, second = self.edges[first_index], self.edges[second_index]
            if first.oneway != OneWay.NO and first.a == node:
                first_index, second_index, first, second = second_index, first_index, second, first
            a, b = first.other_end(node), second.other_end(node)
            # A town's edge does run on into the open road: cutting the road there split its twisty stretches and lost the
            # stops that rode the C-28 and the C-462 (bench, 2026-10-19). BUILT_UP goes by the share of the length instead.
            same_road = first.road_class == second.road_class and first.road == second.road and first.access == second.access
            if a == b or node in (a, b) or not same_road or not _continues(first, second, node):
                continue
            merged = self._merge(first, second, node, a, b)
            incident[a].discard(first_index)
            incident[a].add(merged)
            incident[b].discard(second_index)
            incident[b].add(merged)
            incident[node].clear()

    def _merge(self, first: _Edge, second: _Edge, node: int, a: int, b: int) -> int:
        first.alive = second.alive = False
        self.edges.append(
            _Edge(
                a=a,
                b=b,
                time_s=first.time_s + second.time_s,
                length_m=first.length_m + second.length_m,
                fun_m=first.fun_m + second.fun_m,
                road_class=first.road_class,
                road=first.road,
                narrow_m=first.narrow_m + second.narrow_m,
                posted_kmh=min(first.posted_kmh, second.posted_kmh),
                fords=first.fords + second.fords,
                oneway=first.oneway,
                access=first.access,
                built_up_m=first.built_up_m + second.built_up_m,
                geometry=np.concatenate(
                    [first.geometry_from(a), self.node_lonlat[node : node + 1], second.geometry_from(node)]
                ),
            )
        )
        return len(self.edges) - 1

    def finish(self) -> RoutingGraph:
        alive = [edge for edge in self.edges if edge.alive]
        edge_from = np.array([edge.a for edge in alive], dtype=np.int64)
        edge_to = np.array([edge.b for edge in alive], dtype=np.int64)
        oneway = np.array([edge.oneway for edge in alive], dtype=np.uint8)
        kept_nodes = _strongly_connected_nodes(len(self.junction_ids), edge_from, edge_to, oneway == OneWay.YES)
        new_index = np.full(len(self.junction_ids), -1, dtype=np.int64)
        new_index[kept_nodes] = np.arange(len(kept_nodes))
        keep = (new_index[edge_from] >= 0) & (new_index[edge_to] >= 0)
        kept = [edge for edge, k in zip(alive, keep) if k]
        return RoutingGraph(
            node_ids=self.junction_ids[kept_nodes],
            node_lonlat=self.node_lonlat[kept_nodes],
            edge_from=new_index[edge_from[keep]],
            edge_to=new_index[edge_to[keep]],
            edge_time_s=np.array([edge.time_s for edge in kept]),
            edge_length_m=np.array([edge.length_m for edge in kept]),
            edge_fun_m=np.array([edge.fun_m for edge in kept]),
            edge_class=np.array([edge.road_class for edge in kept], dtype=np.uint8),
            edge_narrow=np.array([round(255 * edge.narrow_m / edge.length_m) for edge in kept], dtype=np.uint8),
            edge_posted_kmh=np.array([0 if np.isinf(edge.posted_kmh) else edge.posted_kmh for edge in kept], dtype=np.uint8),
            edge_fords=np.array([min(edge.fords, 255) for edge in kept], dtype=np.uint8),
            edge_oneway=oneway[keep],
            edge_heading=np.array([self._headings(edge) for edge in kept], dtype=np.uint8).reshape(-1, 2),
            edge_flags=np.array([edge.access | (EdgeFlag.BUILT_UP if 2 * edge.built_up_m > edge.length_m else 0) for edge in kept], dtype=np.uint8),
            edge_road=np.array([edge.road for edge in kept], dtype=np.int64),
            edge_geometry=[self._simplified_geometry(edge) for edge in kept],
            road_names=list(self.road_index),
        )

    def _headings(self, edge: _Edge) -> tuple[int, int]:
        """Riding the edge from a to b: its heading leaving a and arriving at b, in HEADING_STEPS anticlockwise from east."""
        line = project_to_meters(np.concatenate([self.node_lonlat[edge.a : edge.a + 1], edge.geometry, self.node_lonlat[edge.b : edge.b + 1]]))
        leaving = _point_along(line, HEADING_SPAN_M) - line[0]
        arriving = line[-1] - _point_along(line[::-1], HEADING_SPAN_M)
        return _heading_steps(leaving), _heading_steps(arriving)

    def _simplified_geometry(self, edge: _Edge) -> np.ndarray:
        if len(edge.geometry) == 0:
            return edge.geometry
        full = np.concatenate([self.node_lonlat[edge.a : edge.a + 1], edge.geometry, self.node_lonlat[edge.b : edge.b + 1]])
        kept = simplify_indices(project_to_meters(full), GEOMETRY_TOLERANCE_M)
        return full[kept[1:-1]]


def _point_along(line: np.ndarray, distance_m: float) -> np.ndarray:
    """The first point of the line at least `distance_m` from its start, or its end."""
    far = np.flatnonzero(np.hypot(*(line - line[0]).T) >= distance_m)
    return line[far[0]] if len(far) else line[-1]


def _heading_steps(direction: np.ndarray) -> int:
    angle = np.arctan2(direction[1], direction[0]) % (2 * np.pi)
    return int(round(angle / (2 * np.pi) * HEADING_STEPS)) % HEADING_STEPS


def _continues(first: _Edge, second: _Edge, node: int) -> bool:
    """Whether the two edges make one road through `node`, ridden the same way: both two-way, or one-way from `first`
    into `second` (`first` comes in, `second` goes out)."""
    if first.oneway != second.oneway:
        return False
    return first.oneway == OneWay.NO or (first.b == node and second.a == node)


def _strongly_connected_nodes(node_count: int, edge_from: np.ndarray, edge_to: np.ndarray, oneway: np.ndarray) -> np.ndarray:
    """Nodes of the strongly connected components of at least MIN_COMPONENT_NODES: from any of them a rider can reach
    every other one of its component and come back (Kosaraju, iterative)."""
    two_way = ~oneway
    tails = np.concatenate([edge_from, edge_to[two_way]])
    heads = np.concatenate([edge_to, edge_from[two_way]])
    order = _finish_order(node_count, _neighbours(node_count, tails, heads))
    reverse = _neighbours(node_count, heads, tails)
    component = np.full(node_count, -1, dtype=np.int64)
    kept: list[int] = []
    for seed in reversed(order):
        if component[seed] >= 0:
            continue
        members = _flood(seed, reverse, component)
        if len(members) >= MIN_COMPONENT_NODES:
            kept.extend(members)
    return np.array(sorted(kept), dtype=np.int64)


def _neighbours(node_count: int, tails: np.ndarray, heads: np.ndarray) -> list[list[int]]:
    neighbours: list[list[int]] = [[] for _ in range(node_count)]
    for tail, head in zip(tails.tolist(), heads.tolist()):
        neighbours[tail].append(head)
    return neighbours


def _finish_order(node_count: int, neighbours: list[list[int]]) -> list[int]:
    """Nodes with an edge, in the order a depth-first search finishes them."""
    visited = np.zeros(node_count, dtype=bool)
    order: list[int] = []
    for root in range(node_count):
        if visited[root] or not neighbours[root]:
            continue
        visited[root] = True
        stack = [(root, 0)]
        while stack:
            node, next_index = stack[-1]
            if next_index < len(neighbours[node]):
                stack[-1] = (node, next_index + 1)
                neighbour = neighbours[node][next_index]
                if not visited[neighbour]:
                    visited[neighbour] = True
                    stack.append((neighbour, 0))
            else:
                stack.pop()
                order.append(node)
    return order


def _flood(seed: int, neighbours: list[list[int]], component: np.ndarray) -> list[int]:
    component[seed] = seed
    members, queue = [seed], deque([seed])
    while queue:
        for neighbour in neighbours[queue.popleft()]:
            if component[neighbour] < 0:
                component[neighbour] = seed
                members.append(neighbour)
                queue.append(neighbour)
    return members
