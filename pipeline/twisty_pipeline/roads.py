"""Road model: classes, OSM tag interpretation and the travel speed model."""

import re
from dataclasses import dataclass, field, replace
from enum import IntEnum

import numpy as np


class OneWay(IntEnum):
    NO = 0
    # Ridden only in the order of the way's nodes.
    YES = 1
    # One-way in a town but ridden both ways: the graph lacks most of the town's streets, so the legal way round can be a
    # long loop through the next village. The direction is kept so that the bench can tell how much is ridden against it.
    IN_TOWN = 2


class RoadClass(IntEnum):
    MOTORWAY = 0
    TRUNK = 1
    PRIMARY = 2
    SECONDARY = 3
    TERTIARY = 4
    UNCLASSIFIED = 5
    LINK = 6
    # Anything unpaved, whatever its OSM class: only routed when the rider opts in.
    TRACK = 7
    # A short residential street kept to join the dead end of a road to the network (see connectors.py).
    RESIDENTIAL = 8


RESIDENTIAL_HIGHWAY = "residential"

HIGHWAY_TO_CLASS = {
    "motorway": RoadClass.MOTORWAY,
    "trunk": RoadClass.TRUNK,
    "primary": RoadClass.PRIMARY,
    "secondary": RoadClass.SECONDARY,
    "tertiary": RoadClass.TERTIARY,
    "unclassified": RoadClass.UNCLASSIFIED,
    "motorway_link": RoadClass.LINK,
    "trunk_link": RoadClass.LINK,
    "primary_link": RoadClass.LINK,
    "secondary_link": RoadClass.LINK,
    "tertiary_link": RoadClass.LINK,
    "track": RoadClass.TRACK,
}

# Cruising speeds for a motorcycle keeping a sensible pace, before curve and limit caps.
BASE_SPEED_KMH = {
    RoadClass.MOTORWAY: 115.0,
    RoadClass.TRUNK: 95.0,
    RoadClass.PRIMARY: 80.0,
    RoadClass.SECONDARY: 70.0,
    RoadClass.TERTIARY: 60.0,
    RoadClass.UNCLASSIFIED: 45.0,
    RoadClass.LINK: 50.0,
    RoadClass.TRACK: 30.0,
    RoadClass.RESIDENTIAL: 30.0,
}

# Curves cap speed: cap = CURVE_SPEED_KMH / (1 + twist / CURVE_SPEED_HALVING_TWIST).
CURVE_SPEED_KMH = 100.0
CURVE_SPEED_HALVING_TWIST = 250.0  # deg/km at which the curve cap halves
MIN_SPEED_KMH = 15.0

# Spanish implicit limits (https://wiki.openstreetmap.org/wiki/Speed_limits#Spain).
IMPLICIT_MAXSPEED_KMH = {"ES:urban": 50.0, "ES:rural": 90.0, "ES:trunk": 100.0, "ES:motorway": 120.0}

PAVED_SURFACES = {"asphalt", "paved", "concrete", "concrete:plates", "concrete:lanes", "paving_stones", "sett", "chipseal"}
# Cobbles carry a motorcycle through a village, but nobody leans into a bend on them.
ROUGH_PAVED_SURFACES = {"cobblestone", "unhewn_cobblestone"}
# Any other surface is not tarmac: the unpaved values, and the ones mappers make up ("tierra", "ripio", "dirt; asphalt").
RIDEABLE_SURFACES = PAVED_SURFACES | ROUGH_PAVED_SURFACES
# Grade 1 is a solid, usually paved surface; every other grade is a gravel or dirt track.
UNPAVED_TRACKTYPES = {"grade2", "grade3", "grade4", "grade5"}
# "bad" is still fine on a road bike as a way through, but not a road to be sent to for its curves: leaning into a
# bend on broken tarmac is another matter. Worse needs knobbly tyres, and the worst only suits tractors.
UNPAVED_SMOOTHNESS = {"very_bad", "horrible"}
IMPASSABLE_SMOOTHNESS = {"very_horrible", "impassable"}
# Spanish forest tracks are often mapped without a surface tag, but their name gives them away.
UNPAVED_NAME_PREFIXES = ("pista ",)
UNPAVED_NAME_WORDS = {"forestal", "basobidea"}
# Vías pecuarias are drove roads: motor traffic is allowed on them only by exception (Ley 3/1995), and one without a
# paved surface or a number is a track.
DROVE_ROAD_NAME = re.compile(r"^(cañada|vereda|cordel|colada)\b", re.IGNORECASE)
# Mappers file many local roads as `unclassified`, lanes and numbered roads alike. The ones with a number or the name of
# a road (Basque puts it last: "Etxalar - Zugarramurdi errepidea") are ridden at a tertiary pace; Camino, Camí and the
# unnamed lanes stay as they are.
ROAD_NAME = re.compile(r"^(carretera|ctra\.?|estrada|carreter[ií]n)\b|\berrepidea\b", re.IGNORECASE)
NO_ACCESS = {"no", "private", "agricultural", "forestry", "permit"}
# A road whose surface is not mapped, with a track of the same ref or name close by, is probably the same road: the
# mapper tagged the stretch that is a track and left the rest. About 10 km in degrees of latitude.
SAME_ROAD_TRACK_RADIUS_DEG = 0.1
# At or below this limit inside a built-up area the road crosses a town: traffic, crossings and speed bumps instead
# of fun. Outside one the limit warns about the bends (mountain roads are posted at 30 or 40), so it says nothing.
URBAN_MAXSPEED_KMH = 50.0
# A speed limit tagged as urban, lights and sidewalks all say the road is in a built-up area.
URBAN_SPEED_SOURCE_KEYS = ("source:maxspeed", "zone:maxspeed", "maxspeed:type")
NO_SIDEWALK = {"no", "none"}
# A street, whatever its limit and whether or not the mapper added a sidewalk, is in a town.
STREET_NAME = re.compile(
    r"^(calle|carrer|avenida|avinguda|rúa|paseo|passeig|plaza|plaça|travesía|ronda|glorieta"
    r"|urbanización|urbanització|polígono)\b|\b(kalea|etorbidea)\b",
    re.IGNORECASE,
)
# A one-way road is ridden in its direction only (see travel_direction) and is not sought out for its curves.
ONEWAY_VALUES = {"yes", "1", "-1", "reversible", "alternating"}
# The tags that set the one direction a way may be ridden in. A motorway and its ramps are one-way in OSM unless tagged
# otherwise, and so is a roundabout. `reversible` and `alternating` change with the hour, so they stay two-way.
ONE_WAY_FORWARD = {"yes", "1", "true"}
ONE_WAY_BACKWARD = "-1"
IMPLIED_ONE_WAY_HIGHWAYS = {"motorway", "motorway_link"}
ROUNDABOUT_JUNCTIONS = {"roundabout", "circular"}
ACCESS_KEYS = ("access", "vehicle", "motor_vehicle", "motorcycle")
ROUGH_SMOOTHNESS = "bad"
LOOSE_GRAVEL_HAZARD = "loose_gravel"
# Where a driveway, a parking aisle or an alley joins a tertiary road, the junction is not a road to ride for fun.
SERVICE_WAYS = {"driveway", "parking_aisle", "alley", "drive-through"}
# Barriers on a node that a motorcycle cannot pass, unless a tag lets motorcycles through.
BLOCKING_BARRIERS = {"block", "jersey_barrier", "bollard", "chain"}
GATES = {"gate", "lift_gate"}
OPEN_TO_MOTORCYCLES = {"yes", "permissive"}
MOTORCYCLE_KEYS = ("access", "motor_vehicle", "motorcycle")
# A road a car can hardly share with another one: oncoming traffic in blind bends. Counted per metre of road.
NARROW_WIDTH_M = 3.5
# Limits at or below this on mountain roads warn about the bends: the app tells the rider the road is signed that way.
POSTED_MAX_KMH = 40.0
# Fords on these roads, as mapped, are usually dry dips (many were added by an editor's "connect the stream" quick fix):
# the road keeps its fun and the rider is told. Anywhere else a ford is no road to be sent to.
FORD_KEEPS_FUN_HIGHWAYS = {"trunk", "primary", "secondary", "tertiary"}
# Open to those with business there: routable to reach an end point, but no road to be sent to for its curves.
DESTINATION_ONLY = {"destination", "residents", "customers", "delivery"}
# Curves are only fun at pace: bends on a farm lane are taken in second gear, not leaned into.
# Fun scales with the cruising speed the road class allows, from nothing (crawling) to full (open road).
# Posted limits are ignored here: on mountain passes they warn about the bends rather than mark a slow road.
PACE_SPEED_KMH = (40.0, 60.0)
# Riders who opt into tracks came for them, but a great tarmac road should still win over gravel.
TRACK_FUN_WEIGHT = 0.5


@dataclass(frozen=True)
class Way:
    id: int
    road_class: RoadClass
    name: str | None
    ref: str | None
    maxspeed_kmh: float | None
    roundabout: bool
    node_ids: np.ndarray  # int64, shape (n,)
    lonlat: np.ndarray  # float64, shape (n, 2)
    built_up: bool = False  # in a town: by its tags, or (see builtup.py) by the places around it
    no_fun: bool = False  # routable, but its tags say a rider should not be sent to it for the curves
    narrow: bool = False  # a single lane for both directions, or no wider than NARROW_WIDTH_M
    highway: str = ""  # the highway tag as mapped, before a road's name or ref changes its class
    ford_positions: tuple[int, ...] = ()  # where in node_ids the ford nodes are
    promoted_unverified: bool = False  # `unclassified` made tertiary by its name, with no surface tag to back it up
    paved_tag: bool = False  # a surface or tracktype says it is paved
    closed_part_of_year: bool = False  # a conditional restriction closes it to motor traffic part of the year
    destination_only: bool = False  # open only to those with business there
    oneway: OneWay = OneWay.NO  # the way's nodes are in the order it may be ridden


def parse_maxspeed(value: str | None) -> float | None:
    if not value:
        return None
    if value in IMPLICIT_MAXSPEED_KMH:
        return IMPLICIT_MAXSPEED_KMH[value]
    match = re.match(r"^\s*(\d+)\s*$", value)
    return float(match.group(1)) if match else None


@dataclass(frozen=True)
class NodeFlags:
    """Nodes of the road network whose tags matter to the ways through them (sorted arrays of OSM ids)."""

    blocked: np.ndarray  # a rider cannot pass: the ways through it are cut there and not joined
    gates: np.ndarray  # a gate nobody said a motorcycle may pass: the ways through it get no fun
    fords: np.ndarray  # a ford: the way through it is told so, and has no fun unless a numbered road crosses it dry
    perennial_fords: np.ndarray = field(default_factory=lambda: np.array([], dtype=np.int64))  # fords on a river or canal


def node_flags(nodes: dict[int, dict[str, str]], on_perennial_waterway: frozenset[int] = frozenset()) -> NodeFlags:
    """Sort the tagged nodes by what they do to the ways through them."""
    blocked, gates, fords = [], [], []
    for node_id, tags in nodes.items():
        barrier = tags.get("barrier")
        closed = any(tags.get(key) in NO_ACCESS for key in ACCESS_KEYS)
        motorcycles_pass = any(tags.get(key) in OPEN_TO_MOTORCYCLES for key in MOTORCYCLE_KEYS)
        if closed or (barrier in BLOCKING_BARRIERS and not motorcycles_pass):
            blocked.append(node_id)
        elif barrier in GATES and not any(key in tags for key in ACCESS_KEYS):
            gates.append(node_id)
        if tags.get("ford") == "yes":
            fords.append(node_id)
    perennial = [node_id for node_id in fords if node_id in on_perennial_waterway]
    return NodeFlags(*(np.array(sorted(ids), dtype=np.int64) for ids in (blocked, gates, fords, perennial)))


def first_value(value: str | None) -> str | None:
    """OSM multi-values are `;`-separated; keep the first one."""
    if not value:
        return None
    return value.split(";")[0].strip() or None


def is_built_up_by_tags(tags: dict[str, str]) -> bool:
    """Whether the tags say the road is in a town: an urban limit, street lights, a sidewalk or a street name."""
    if tags.get("maxspeed") == "ES:urban" or any("urban" in tags.get(key, "") for key in URBAN_SPEED_SOURCE_KEYS):
        return True
    if tags.get("lit") == "yes":
        return True
    if STREET_NAME.search(tags.get("name", "")):
        return True
    return any(key.startswith("sidewalk") and value not in NO_SIDEWALK for key, value in tags.items())


def is_fun_blocked(tags: dict[str, str]) -> bool:
    """Whether the tags make a road no place to be sent for its curves, though it may still be a way through."""
    return any(reason(tags) for reason in FUN_BLOCKERS)


def _is_one_way(tags: dict[str, str]) -> bool:
    return tags.get("oneway") in ONEWAY_VALUES


def travel_direction(tags: dict[str, str]) -> int:
    """1 when the way may only be ridden in the order of its nodes, -1 only against it, 0 both ways."""
    oneway = tags.get("oneway")
    if oneway == ONE_WAY_BACKWARD:
        return -1
    if oneway in ONE_WAY_FORWARD:
        return 1
    implied = tags.get("highway") in IMPLIED_ONE_WAY_HIGHWAYS or tags.get("junction") in ROUNDABOUT_JUNCTIONS
    return 1 if implied and oneway is None else 0


def _is_service_way(tags: dict[str, str]) -> bool:
    return tags.get("service") in SERVICE_WAYS


def _is_rough(tags: dict[str, str]) -> bool:
    rough_surface = any(surface in ROUGH_PAVED_SURFACES for surface in surfaces(tags))
    return rough_surface or tags.get("smoothness") == ROUGH_SMOOTHNESS or tags.get("hazard") == LOOSE_GRAVEL_HAZARD


def is_destination_only(tags: dict[str, str]) -> bool:
    return any(tags.get(key) in DESTINATION_ONLY for key in ACCESS_KEYS)


def is_closed_part_of_the_year(tags: dict[str, str]) -> bool:
    """A conditional restriction that starts by closing the road: "no @ (Jun 11-Sep 30)", "private @ (Dec-May)"."""
    return any(tags.get(f"{key}:conditional", "").split("@")[0].strip() in NO_ACCESS for key in ACCESS_KEYS)


FUN_BLOCKERS = (_is_one_way, is_closed_part_of_the_year, is_destination_only, _is_rough, _is_service_way)


def is_narrow(tags: dict[str, str]) -> bool:
    """Whether the tags say two vehicles can hardly pass: narrow=yes, a single lane that is not one-way, or a width."""
    if tags.get("narrow") == "yes":
        return True
    if tags.get("lanes") == "1" and not _is_one_way(tags):
        return True
    width = re.match(r"^\s*(\d+(?:[.,]\d+)?)", tags.get("width", ""))
    return width is not None and float(width.group(1).replace(",", ".")) <= NARROW_WIDTH_M


def is_accessible(tags: dict[str, str]) -> bool:
    # `access=designated` is a lane kept for a class of vehicle (a bus and carpool lane), not for riders.
    return tags.get("access") != "designated" and not any(tags.get(key) in NO_ACCESS for key in ACCESS_KEYS)


def is_passable(tags: dict[str, str]) -> bool:
    return tags.get("smoothness") not in IMPASSABLE_SMOOTHNESS


def surfaces(tags: dict[str, str]) -> list[str]:
    """The surface values of a way: OSM separates several with `;`."""
    return [part.strip().lower() for part in tags.get("surface", "").split(";") if part.strip()]


def is_paved(tags: dict[str, str]) -> bool:
    """Whether a road bike can ride it; anything else becomes a track so nobody ends up on gravel by surprise. No surface
    tag is tarmac, as most roads are mapped; a surface tag must name a rideable one, every part of it."""
    if tags.get("highway") == "track" or tags.get("ford") == "yes":
        return False
    if any(surface not in RIDEABLE_SURFACES for surface in surfaces(tags)) or tags.get("tracktype") in UNPAVED_TRACKTYPES:
        return False
    if tags.get("smoothness") in UNPAVED_SMOOTHNESS:
        return False
    name = tags.get("name", "").lower()
    if DROVE_ROAD_NAME.match(name) and not has_paved_tag(tags) and not first_value(tags.get("ref")):
        return False
    return not name.startswith(UNPAVED_NAME_PREFIXES) and UNPAVED_NAME_WORDS.isdisjoint(name.split())


def has_paved_tag(tags: dict[str, str]) -> bool:
    parts = surfaces(tags)
    return (bool(parts) and all(surface in PAVED_SURFACES for surface in parts)) or tags.get("tracktype") == "grade1"


def local_road_class(road_class: RoadClass, tags: dict[str, str]) -> RoadClass:
    """An `unclassified` road with the name of a road, or a ref and a surface mapped as paved, is a tertiary road in all
    but its tag. A ref alone proves nothing: a third of the ref'd unclassified ways that say what they are made of are
    unpaved (provincial paths, forest roads, hiking routes). A narrow road without a paved surface is more often a
    lane than a road, and one the owner merely allows riders on is not for passers-by."""
    if road_class != RoadClass.UNCLASSIFIED or _is_permissive(tags) or (is_narrow(tags) and not has_paved_tag(tags)):
        return road_class
    if ROAD_NAME.search(tags.get("name", "")) or (first_value(tags.get("ref")) and has_paved_tag(tags)):
        return RoadClass.TERTIARY
    return road_class


def _is_permissive(tags: dict[str, str]) -> bool:
    return any(tags.get(key) == "permissive" for key in ACCESS_KEYS)


def demote_beside_tracks(ways: list[Way]) -> list[Way]:
    """Where another way of the same road is a track (the same ref, or the same name within SAME_ROAD_TRACK_RADIUS_DEG),
    the mapper most likely tagged the stretch they saw unpaved and left the rest: a way promoted without a surface tag
    goes back to `unclassified`, and an `unclassified` lane with no paved tag becomes a track too."""
    tracks = [way for way in ways if way.road_class == RoadClass.TRACK]
    track_refs = {way.ref for way in tracks if way.ref}
    track_names = {(way.name, _cell(way)) for way in tracks if way.name}

    def demoted(way: Way) -> Way:
        if not _beside_track(way, track_refs, track_names):
            return way
        if way.promoted_unverified:
            return replace(way, road_class=RoadClass.UNCLASSIFIED, promoted_unverified=False)
        if way.road_class == RoadClass.UNCLASSIFIED and not way.paved_tag:
            return replace(way, road_class=RoadClass.TRACK)
        return way

    return [demoted(way) for way in ways]


def _beside_track(way: Way, track_refs: set[str], track_names: set[tuple[str, tuple[int, int]]]) -> bool:
    column, row = _cell(way)
    return (way.ref in track_refs) or any(
        (way.name, (column + dx, row + dy)) in track_names for dx in (-1, 0, 1) for dy in (-1, 0, 1)
    )


def _cell(way: Way) -> tuple[int, int]:
    lon, lat = way.lonlat[len(way.lonlat) // 2]
    return int(lon // SAME_ROAD_TRACK_RADIUS_DEG), int(lat // SAME_ROAD_TRACK_RADIUS_DEG)


def travel_speed_kmh(road_class: RoadClass, maxspeed_kmh: float | None, twist_deg_per_km: np.ndarray) -> np.ndarray:
    """The speed at each point of a way: the class speed, capped by the posted limit and by the bends around it."""
    speed = BASE_SPEED_KMH[road_class]
    if maxspeed_kmh:
        speed = min(speed, maxspeed_kmh)
    curve_cap = CURVE_SPEED_KMH / (1.0 + twist_deg_per_km / CURVE_SPEED_HALVING_TWIST)
    return np.maximum(MIN_SPEED_KMH, np.minimum(speed, curve_cap))


def cumulative_time_s(distance_m: np.ndarray, speed_kmh: np.ndarray) -> np.ndarray:
    """Riding time from a way's first vertex at the speed of each vertex. A stretch takes the difference of its ends, so
    where junctions cut the way does not change how long it takes."""
    pace_s_per_m = 3.6 / speed_kmh
    return np.concatenate([[0.0], np.cumsum(np.diff(distance_m) * (pace_s_per_m[:-1] + pace_s_per_m[1:]) / 2)])


def pace_factor(road_class: RoadClass) -> float:
    """Share (0..1) of a road's curve fun that survives the pace it can be ridden at."""
    return float(np.interp(BASE_SPEED_KMH[road_class], PACE_SPEED_KMH, (0.0, 1.0)))


def fun_weight(way: Way) -> float:
    """Multiplier (0..1) applied to the curve fun of a way."""
    if way.no_fun or way.road_class in (RoadClass.MOTORWAY, RoadClass.LINK, RoadClass.RESIDENTIAL):
        return 0.0
    if way.road_class == RoadClass.TRACK:
        return TRACK_FUN_WEIGHT
    if way.built_up and way.maxspeed_kmh is not None and way.maxspeed_kmh <= URBAN_MAXSPEED_KMH:
        return 0.0
    return pace_factor(way.road_class)


def is_town_crossing(way: Way) -> bool:
    """A built-up stretch with no fun: its bends are the town's corners, not the road's."""
    return way.built_up and fun_weight(way) == 0.0


def with_town_one_ways(ways: list[Way]) -> list[Way]:
    """The ways, with the one-way streets of towns ridden both ways. Motorways, trunk roads, ramps and roundabouts keep
    their direction everywhere: their other carriageway or the rest of the roundabout is in the graph."""
    return [replace(way, oneway=OneWay.IN_TOWN) if _is_town_one_way(way) else way for way in ways]


def _is_town_one_way(way: Way) -> bool:
    in_town = way.built_up or way.road_class == RoadClass.RESIDENTIAL
    always_directed = way.roundabout or way.road_class in (RoadClass.MOTORWAY, RoadClass.TRUNK, RoadClass.LINK)
    return way.oneway == OneWay.YES and in_town and not always_directed


def road_label(way: Way) -> str:
    """Human-readable road name, e.g. "CV-35 · Carretera València - Ademuz"; empty when unnamed."""
    return " · ".join(part for part in (way.ref, way.name) if part)
