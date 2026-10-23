"""Joining OSM ways into continuous roads ("chains") so curvy runs are not cut by arbitrary way splits."""

from collections import defaultdict, deque
from dataclasses import dataclass
from itertools import combinations

import numpy as np

from .curvature import TurningProfile, turning_profile, vertex_fun
from .roads import RoadClass, Way, is_town_crossing

# Where more than two ways of a road meet (the two carriageways of a dual road, a branch), the road goes on along the way
# that turns least, if it turns no more than this; the others start chains of their own.
MAX_JOIN_TURN_DEG = 60.0

TWISTY_ELIGIBLE_CLASSES = {
    RoadClass.TRUNK, RoadClass.PRIMARY, RoadClass.SECONDARY, RoadClass.TERTIARY, RoadClass.UNCLASSIFIED,
}


WayKey = tuple[int, int, int]
# The curve fun of each chained way's vertices, in the way's own order (`curve_fun_by_way`).
CurveFun = dict[WayKey, np.ndarray]


def way_key(way: Way) -> WayKey:
    """A way's id and end nodes: the pieces of a way cut at a barrier share its id but end at nodes of their own."""
    return way.id, int(way.node_ids[0]), int(way.node_ids[-1])


@dataclass(frozen=True)
class WaySpan:
    """Where a way's vertices sit in its chain: positions first..last, in the chain's order or reversed."""

    way: WayKey
    first: int
    last: int
    reversed: bool
    town_crossing: bool


@dataclass(frozen=True)
class Chain:
    name: str | None
    ref: str | None
    road_class: RoadClass
    node_ids: np.ndarray
    lonlat: np.ndarray
    ways: tuple[WaySpan, ...]


def is_twisty_eligible(way: Way) -> bool:
    return way.road_class in TWISTY_ELIGIBLE_CLASSES and not way.roundabout


def build_chains(ways: list[Way]) -> list[Chain]:
    groups: dict[str, list[Way]] = defaultdict(list)
    for way in ways:
        if is_twisty_eligible(way):
            groups[_road_identity(way)].append(way)
    return [chain for group in groups.values() for chain in _join(group)]


def _road_identity(way: Way) -> str:
    """Ways of the same road share a ref (or name); unnamed roads join with unnamed roads of the same class."""
    if way.ref:
        return f"ref:{way.ref}"
    if way.name:
        return f"name:{way.name}"
    return f"unnamed:{way.road_class}"


def _join(ways: list[Way]) -> list[Chain]:
    """Join ways end-to-end through nodes where two ways of the group meet, or where the road goes straight on."""
    incidences: dict[int, list[int]] = defaultdict(list)
    for index, way in enumerate(ways):
        incidences[int(way.node_ids[0])].append(index)
        incidences[int(way.node_ids[-1])].append(index)
    partners = _partners(ways, incidences)
    used = [False] * len(ways)

    def continuation(node: int, came_from: int) -> int | None:
        return partners.get((node, came_from))

    chains = []
    for seed in range(len(ways)):
        if used[seed]:
            continue
        used[seed] = True
        sequence: deque[tuple[int, bool]] = deque([(seed, False)])

        node, current = int(ways[seed].node_ids[-1]), seed
        while (following := continuation(node, current)) is not None and not used[following]:
            reverse = int(ways[following].node_ids[-1]) == node
            sequence.append((following, reverse))
            used[following] = True
            node = int(ways[following].node_ids[0] if reverse else ways[following].node_ids[-1])
            current = following

        node, current = int(ways[seed].node_ids[0]), seed
        while (preceding := continuation(node, current)) is not None and not used[preceding]:
            reverse = int(ways[preceding].node_ids[0]) == node
            sequence.appendleft((preceding, reverse))
            used[preceding] = True
            node = int(ways[preceding].node_ids[-1] if reverse else ways[preceding].node_ids[0])
            current = preceding

        chains.append(_concatenate([(ways[i], reverse) for i, reverse in sequence]))
    return chains


def _partners(ways: list[Way], incidences: dict[int, list[int]]) -> dict[tuple[int, int], int]:
    """Which way each way goes on into at a node, decided per node so that it does not depend on the order of the ways.

    Where only two ways meet they are partners. Where more meet, the pairs that turn least are taken first, up to
    MAX_JOIN_TURN_DEG, each way in at most one pair."""
    partners: dict[tuple[int, int], int] = {}
    for node, touching in incidences.items():
        meeting = sorted(set(touching))
        if len(meeting) < 2:
            continue
        if len(touching) == 2:
            first, second = meeting
            partners[(node, first)], partners[(node, second)] = second, first
            continue
        turns = sorted(
            (_turn_deg(_heading_towards(ways[first], node), _heading_away(ways[second], node)), first, second)
            for first, second in combinations(meeting, 2)
        )
        for turn, first, second in turns:
            if turn <= MAX_JOIN_TURN_DEG and (node, first) not in partners and (node, second) not in partners:
                partners[(node, first)], partners[(node, second)] = second, first
    return partners


def _heading_towards(way: Way, node: int) -> float:
    """Compass-free heading, in degrees, of the way as it arrives at `node`."""
    at_end = int(way.node_ids[-1]) == node
    before, here = (way.lonlat[-2], way.lonlat[-1]) if at_end else (way.lonlat[1], way.lonlat[0])
    return _heading(before, here)


def _heading_away(way: Way, node: int) -> float:
    """Heading, in degrees, of the way as it leaves `node`."""
    at_start = int(way.node_ids[0]) == node
    here, after = (way.lonlat[0], way.lonlat[1]) if at_start else (way.lonlat[-1], way.lonlat[-2])
    return _heading(here, after)


def _heading(origin: np.ndarray, target: np.ndarray) -> float:
    east = (target[0] - origin[0]) * np.cos(np.radians(origin[1]))
    return float(np.degrees(np.arctan2(east, target[1] - origin[1])))


def _turn_deg(arriving: float, leaving: float) -> float:
    # Rounded so that two equally straight carriageways tie and the first-listed one wins at both of its ends.
    return round(abs((leaving - arriving + 180.0) % 360.0 - 180.0), 2)


def _concatenate(parts: list[tuple[Way, bool]]) -> Chain:
    node_ids, lonlat, spans, first = [], [], [], 0
    for position, (way, reverse) in enumerate(parts):
        ids = way.node_ids[::-1] if reverse else way.node_ids
        coords = way.lonlat[::-1] if reverse else way.lonlat
        skip = 1 if position > 0 else 0  # the joining node is already present
        node_ids.append(ids[skip:])
        lonlat.append(coords[skip:])
        spans.append(WaySpan(way_key(way), first, first + len(ids) - 1, reverse, is_town_crossing(way)))
        first += len(ids) - 1
    main_way = max((way for way, _ in parts), key=lambda way: len(way.node_ids))
    return Chain(
        name=main_way.name,
        ref=main_way.ref,
        road_class=main_way.road_class,
        node_ids=np.concatenate(node_ids),
        lonlat=np.concatenate(lonlat),
        ways=tuple(spans),
    )


def road_profile(chain: Chain) -> TurningProfile:
    """The chain's turning profile without the bends of its town crossings: a crossing has no fun, so its corners are
    not read into the windows of the open road around it either. The profile the fun is read from, in the graph and in
    the twisties alike."""
    profile = turning_profile(chain.lonlat)
    deflection = profile.deflection_deg.copy()
    for span in chain.ways:
        if span.town_crossing:
            deflection[span.first : span.last + 1] = 0.0
    return TurningProfile(profile.distance_m, deflection)


def curve_fun_by_way(chains: list[Chain]) -> CurveFun:
    """The curve fun of each chained way's vertices, in the way's own order, seen along the whole road: a way's window
    then reaches into the ways before and after it, instead of taking the road beyond the way's ends as straight."""
    by_way = {}
    for chain in chains:
        fun = vertex_fun(road_profile(chain))
        for span in chain.ways:
            values = fun[span.first : span.last + 1]
            by_way[span.way] = values[::-1] if span.reversed else values
    return by_way
