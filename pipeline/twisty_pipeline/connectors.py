"""Residential ways kept as connectors: the short links, one street or a few chained, that join the dead end of a road
to the rest of the network."""

import heapq
from collections import defaultdict
from dataclasses import replace

import numpy as np

from .chains import Chain
from .geo import cumulative_distance, project_to_meters
from .roads import Way

# A rider's road ends in a village street a few hundred metres from the next road; a longer link is a street network.
# The limit is for the streets together, not for each.
CONNECTOR_MAX_M = 600.0
# Streets within a cell of a dead end are the only ones a connector can use: a cell is wider than CONNECTOR_MAX_M.
CELL_DEG = 0.01
# Only a road somebody named or numbered, and long enough to be worth reaching, makes its dead end worth a link.
CONNECTOR_MIN_ROAD_M = 1_500.0
# A short bridge or a street with another name splits a road in two chains (Vidrà: 22 km and a 1.4 km tail in the
# village), so a road is as long as the chains with its name or ref around it. About 10 km in degrees of latitude.
SAME_ROAD_RADIUS_DEG = 0.1


def length_m(lonlat: np.ndarray) -> float:
    return float(cumulative_distance(project_to_meters(lonlat))[-1])


def network_node_ids(ways: list[Way]) -> np.ndarray:
    """Sorted ids of the nodes any of the ways goes through."""
    return np.unique(np.concatenate([way.node_ids for way in ways]))


def dead_end_node_ids(ways: list[Way], chains: list[Chain]) -> set[int]:
    """Nodes where a long named or numbered road (a chain: its ways are many and short) ends and nothing else goes through."""
    ids, counts = np.unique(np.concatenate([way.node_ids for way in ways]), return_counts=True)
    alone = set(ids[counts == 1].tolist())
    labelled = [chain for chain in chains if chain.ref or chain.name]
    length_by_cell: dict[tuple[str, int, int], float] = {}
    for chain in labelled:
        key = _cell_key(chain)
        length_by_cell[key] = length_by_cell.get(key, 0.0) + length_m(chain.lonlat)
    ends = {
        int(node)
        for chain in labelled
        if _road_length_m(chain, length_by_cell) >= CONNECTOR_MIN_ROAD_M
        for node in (chain.node_ids[0], chain.node_ids[-1])
    }
    return alone & ends


def _cell_key(chain: Chain) -> tuple[str, int, int]:
    lon, lat = chain.lonlat[len(chain.lonlat) // 2]
    return chain.ref or chain.name, int(lon // SAME_ROAD_RADIUS_DEG), int(lat // SAME_ROAD_RADIUS_DEG)


def _road_length_m(chain: Chain, length_by_cell: dict[tuple[str, int, int], float]) -> float:
    label, column, row = _cell_key(chain)
    return sum(length_by_cell.get((label, column + dx, row + dy), 0.0) for dx in (-1, 0, 1) for dy in (-1, 0, 1))


def cells_around(ways: list[Way], dead_ends: set[int]) -> set[tuple[int, int]]:
    """The grid cells a street joining a dead end can start in: the dead ends' own and the ones next to them."""
    cells = set()
    for way in ways:
        for index in (0, -1):
            if int(way.node_ids[index]) in dead_ends:
                column, row = _cell(way.lonlat[index])
                cells.update((column + dx, row + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    return cells


def in_cells(lon: float, lat: float, cells: set[tuple[int, int]]) -> bool:
    return _cell((lon, lat)) in cells


def _cell(lonlat) -> tuple[int, int]:
    return int(lonlat[0] // CELL_DEG), int(lonlat[1] // CELL_DEG)


def connector_streets(streets: list[Way], dead_ends: set[int], network: np.ndarray) -> list[Way]:
    """Every street between a dead end and a node of the network, and for a dead end with none, the streets of the
    shortest way to the network within CONNECTOR_MAX_M. A dead end with two direct links joins what they join.
    A dead end the streets' ends do not join is looked for again through the streets' middles, in pieces between the
    network nodes they pass; a piece is kept as its whole street when that is no longer than CONNECTOR_MAX_M."""
    links = _links(streets, dead_ends, network)
    pieces, whole_of = [], {}
    for whole in streets:
        short = length_m(whole.lonlat) <= CONNECTOR_MAX_M
        for piece in split_at(whole, network):
            pieces.append(piece)
            whole_of[(piece.id, int(piece.node_ids[0]))] = whole if short else piece
    for dead_end, found in _links(pieces, dead_ends - links.keys(), network).items():
        links[dead_end] = [whole_of[(piece.id, int(piece.node_ids[0]))] for piece in found]
    kept = {(street.id, int(street.node_ids[0])): street for streets_of in links.values() for street in streets_of}
    return list(kept.values())


def _links(streets: list[Way], dead_ends: set[int], network: np.ndarray) -> dict[int, list[Way]]:
    """The streets that join each dead end to the network, joined only at their ends; dead ends with none left out."""
    ends = defaultdict(list)
    for street in streets:
        first, last = int(street.node_ids[0]), int(street.node_ids[-1])
        if first != last and (length := length_m(street.lonlat)) <= CONNECTOR_MAX_M:
            ends[first].append((last, length, street))
            ends[last].append((first, length, street))
    links = {}
    for dead_end in dead_ends & ends.keys():
        direct = [street for other, _, street in ends[dead_end] if _in_network(other, network)]
        reached = {} if direct else _ways_from(dead_end, ends, network)
        nearest = min((node for node in reached if node != dead_end and _in_network(node, network)), key=lambda node: reached[node][0], default=None)
        if found := direct if direct else _streets_back_to(nearest, reached) if nearest is not None else []:
            links[dead_end] = found
    return links


def split_at(street: Way, network: np.ndarray) -> list[Way]:
    """The street in pieces at its inner nodes on the network. The link search joins streets only at their ends, and a
    road may end halfway along one: CV-712 ends at the last node of a street in la Vall d'Ebo, its other run at the one
    before."""
    inner = (np.flatnonzero(_on_network(street.node_ids[1:-1], network)) + 1).tolist()
    if not inner:
        return [street]
    bounds = [0, *inner, len(street.node_ids) - 1]
    return [
        replace(street, node_ids=street.node_ids[first : last + 1], lonlat=street.lonlat[first : last + 1])
        for first, last in zip(bounds[:-1], bounds[1:])
    ]


def _ways_from(start: int, ends: dict[int, list], network: np.ndarray) -> dict[int, tuple[float, int | None, Way | None]]:
    """Dijkstra over the streets from a dead end, up to CONNECTOR_MAX_M, that stops where it meets the network."""
    reached: dict[int, tuple[float, int | None, Way | None]] = {start: (0.0, None, None)}
    queue = [(0.0, start)]
    while queue:
        distance, node = heapq.heappop(queue)
        if distance > reached[node][0] or (node != start and _in_network(node, network)):
            continue
        for other, length, street in ends[node]:
            total = distance + length
            if total <= CONNECTOR_MAX_M and total < reached.get(other, (np.inf,))[0]:
                reached[other] = (total, node, street)
                heapq.heappush(queue, (total, other))
    return reached


def _streets_back_to(node: int, reached: dict) -> list[Way]:
    streets = []
    while reached[node][1] is not None:
        _, node, street = reached[node]
        streets.append(street)
    return streets


def _on_network(nodes: np.ndarray, network: np.ndarray) -> np.ndarray:
    """Which of the nodes the network has. A search in the sorted ids: np.isin sorts the network again on every call, and
    run once per street over Spain it took more than half a day."""
    if len(network) == 0:
        return np.zeros(len(nodes), dtype=bool)
    return network[np.minimum(np.searchsorted(network, nodes), len(network) - 1)] == nodes


def _in_network(node: int, network: np.ndarray) -> bool:
    return len(network) > 0 and network[min(int(np.searchsorted(network, node)), len(network) - 1)] == node
