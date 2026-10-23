"""Pre-filtering OSM PBF extracts and reading drivable roads from them."""

import subprocess
from dataclasses import replace
from hashlib import sha1
from pathlib import Path

import numpy as np
import osmium

from .chains import Chain
from .connectors import cells_around, connector_streets, dead_end_node_ids, in_cells, network_node_ids
from .roads import (
    HIGHWAY_TO_CLASS,
    RoadClass,
    FORD_KEEPS_FUN_HIGHWAYS,
    RESIDENTIAL_HIGHWAY,
    ROUNDABOUT_JUNCTIONS,
    NodeFlags,
    OneWay,
    Way,
    demote_beside_tracks,
    first_value,
    has_paved_tag,
    is_accessible,
    is_built_up_by_tags,
    is_closed_part_of_the_year,
    is_destination_only,
    is_fun_blocked,
    is_narrow,
    is_passable,
    is_paved,
    local_road_class,
    node_flags,
    parse_maxspeed,
    travel_direction,
)

HIGHWAY_FILTER = "w/highway=" + ",".join([*HIGHWAY_TO_CLASS, RESIDENTIAL_HIGHWAY])
# OSM limits a way to 2,000 nodes.
MAX_WAY_NODES = 2_000
NO_NODES = np.array([], dtype=np.int64)


def data_as_of(source: Path) -> str:
    """The extract's replication timestamp, which Geofabrik writes in the header: what the licence notice dates."""
    reader = osmium.io.Reader(str(source), osmium.osm.osm_entity_bits.NOTHING)
    try:
        header = reader.header()
    finally:
        reader.close()
    timestamp = header.get("osmosis_replication_timestamp") or header.get("timestamp")
    if not timestamp:
        raise ValueError(f"{source} has no timestamp in its header")
    return timestamp


def merged(sources: list[Path], work_dir: Path) -> Path:
    """One extract from several that do not overlap (Spain and the Canary Islands), cached between runs."""
    if len(sources) == 1:
        return sources[0]
    work_dir.mkdir(parents=True, exist_ok=True)
    target = work_dir / ("+".join(source.name.removesuffix(".osm.pbf") for source in sources) + ".osm.pbf")
    if not all(_is_fresh(target, source) for source in sources):
        _run(["osmium", "merge", *map(str, sources), "-o", str(target), "--overwrite"])
    return target


def prefilter(source: Path, work_dir: Path) -> Path:
    """Keep only drivable road ways and embed node locations in them (cached between runs)."""
    work_dir.mkdir(parents=True, exist_ok=True)
    # Named after the filter so adding a road class does not silently reuse a stale cache.
    key = sha1(HIGHWAY_FILTER.encode()).hexdigest()[:8]
    roads = work_dir / f"roads-{key}.osm.pbf"
    located = work_dir / f"roads-{key}-located.osm.pbf"
    if _is_fresh(located, source):
        return located
    _run(["osmium", "tags-filter", str(source), HIGHWAY_FILTER, "-o", str(roads), "--overwrite"])
    _run(["osmium", "add-locations-to-ways", str(roads), "-o", str(located), "--overwrite"])
    return located


def extract(source: Path, work_dir: Path, name: str, tag_filter: str) -> Path:
    """Keep only what matches an osmium tag filter such as `n/place=town,village` (cached between runs)."""
    work_dir.mkdir(parents=True, exist_ok=True)
    target = work_dir / f"{name}.osm.pbf"
    if not _is_fresh(target, source):
        _run(["osmium", "tags-filter", str(source), tag_filter, "-o", str(target), "--overwrite"])
    return target


# Tags on a node that decide whether a rider can pass it, or whether a ford is there.
NODE_KEYS = ("barrier", "access", "vehicle", "motor_vehicle", "motorcycle", "ford")


def read_node_flags(located_pbf: Path, waterways_pbf: Path) -> NodeFlags:
    tagged = osmium.FileProcessor(str(located_pbf), osmium.osm.NODE).with_filter(osmium.filter.KeyFilter(*NODE_KEYS))
    nodes = {node.id: dict(node.tags) for node in tagged}
    fords = {node_id for node_id, tags in nodes.items() if tags.get("ford") == "yes"}
    return node_flags(nodes, _fords_on_perennial_waterways(waterways_pbf, fords))


def _fords_on_perennial_waterways(waterways_pbf: Path, fords: set[int]) -> frozenset[int]:
    """Fords on a river or canal that does not dry up: a dip in the road to cross a dry rambla is one thing."""
    found: set[int] = set()
    for waterway in osmium.FileProcessor(str(waterways_pbf), osmium.osm.WAY):
        if waterway.tags.get("intermittent") != "yes":
            found.update(node.ref for node in waterway.nodes if node.ref in fords)
    return frozenset(found)


def read_ways(located_pbf: Path, flags: NodeFlags) -> list[Way]:
    ways = []
    for way in osmium.FileProcessor(str(located_pbf), osmium.osm.WAY):
        if way.tags.get("highway") == RESIDENTIAL_HIGHWAY:
            continue
        parsed = _parse_way(way)
        if parsed is not None:
            ways.append(parsed)
    return [with_node_flags(way, flags) for way in cut_ways(demote_beside_tracks(ways), flags.blocked)]


def with_node_flags(way: Way, flags: NodeFlags) -> Way:
    """The way told where its fords are, and without fun where a gate or a ford is that a numbered road does not cross dry."""
    fords = tuple(np.flatnonzero(_member(flags.fords, way.node_ids)).tolist())
    dry_crossing = way.highway in FORD_KEEPS_FUN_HIGHWAYS and way.ref and not _touches(way.node_ids, flags.perennial_fords)
    no_fun = _touches(way.node_ids, flags.gates) or (len(fords) > 0 and not dry_crossing)
    return replace(way, ford_positions=fords, no_fun=way.no_fun or no_fun)


def read_connectors(located_pbf: Path, ways: list[Way], chains: list[Chain], flags: NodeFlags) -> list[Way]:
    """The residential streets that join the dead end of a long named or numbered road to the rest of the network."""
    dead_ends, network = dead_end_node_ids(ways, chains), network_node_ids(ways)
    cells = cells_around(ways, dead_ends)
    streets = []
    for way in osmium.FileProcessor(str(located_pbf), osmium.osm.WAY):
        if way.tags.get("highway") != RESIDENTIAL_HIGHWAY or not way.nodes:
            continue
        start = way.nodes[0].location
        if start.valid() and in_cells(start.lon, start.lat, cells) and (parsed := _parse_way(way)) is not None:
            streets.append(parsed)
    # Cut at barriers before the search, so that a gate on a street stops the link through it.
    connectors = connector_streets(cut_ways(streets, flags.blocked), dead_ends, network) if streets else []
    return [with_node_flags(way, flags) for way in connectors]


def cut_ways(ways: list[Way], blocked: np.ndarray) -> list[Way]:
    """The ways cut where a node stops riders. A blocked node several ways meet at is only cut off from the ways that
    end there: the gate is on the side road, not across the road that passes by."""
    ids, counts = np.unique(np.concatenate([way.node_ids for way in ways]), return_counts=True)
    junctions = ids[(counts >= 2) & _member(blocked, ids)]
    return [piece for way in ways for piece in cut_way(way, blocked, junctions)]


def cut_way(way: Way, blocked: np.ndarray, junctions: np.ndarray = NO_NODES) -> list[Way]:
    """The pieces of the way between nodes a rider cannot pass. Each piece ends at a node of its own, so that neither
    the pieces nor the other ways meeting there are joined through it."""
    last_node = len(way.node_ids) - 1
    passing = _member(junctions, way.node_ids)
    passing[[0, last_node]] = False
    cuts = set(np.flatnonzero(_member(blocked, way.node_ids) & ~passing).tolist())
    if not cuts:
        return [way]
    bounds = sorted({0, *cuts, last_node})
    pieces = []
    for first, last in zip(bounds[:-1], bounds[1:]):
        ids = way.node_ids[first : last + 1].copy()
        if first in cuts:
            ids[0] = _stranded_id(way.id, first, after=True)
        if last in cuts:
            ids[-1] = _stranded_id(way.id, last, after=False)
        pieces.append(replace(way, node_ids=ids, lonlat=way.lonlat[first : last + 1]))
    return pieces


def _stranded_id(way_id: int, position: int, after: bool) -> int:
    """A node id no other way has (OSM ids are positive): one per way, position and side of a cut."""
    return -(way_id * MAX_WAY_NODES * 2 + position * 2 + int(after))


def _member(sorted_ids: np.ndarray, ids: np.ndarray) -> np.ndarray:
    if len(sorted_ids) == 0:
        return np.zeros(len(ids), dtype=bool)
    position = np.minimum(np.searchsorted(sorted_ids, ids), len(sorted_ids) - 1)
    return sorted_ids[position] == ids


def _touches(ids: np.ndarray, sorted_ids: np.ndarray) -> bool:
    return bool(_member(sorted_ids, ids).any())


def _parse_way(way) -> Way | None:
    nodes = [(node.ref, node.lon, node.lat) for node in way.nodes if node.location.valid()]
    if len(nodes) != len(way.nodes):
        return None
    return way_from_tags(way.id, dict(way.tags), np.array(nodes))


def way_from_tags(way_id: int, tags: dict[str, str], table: np.ndarray) -> Way | None:
    """A drivable way from its tags and its nodes, a table of rows (osm id, lon, lat); None when it is not one."""
    highway = tags.get("highway", "")
    road_class = RoadClass.RESIDENTIAL if highway == RESIDENTIAL_HIGHWAY else HIGHWAY_TO_CLASS.get(highway)
    if road_class is None or tags.get("area") == "yes" or not is_accessible(tags) or not is_passable(tags):
        return None
    if len(table) < 2:
        return None
    name, ref = first_value(tags.get("name")), first_value(tags.get("ref"))
    paved = is_paved(tags)
    direction = travel_direction(tags)
    if direction < 0:
        table = table[::-1]
    local_class = local_road_class(road_class, tags)
    return Way(
        id=way_id,
        road_class=local_class if paved else RoadClass.TRACK,
        name=name,
        ref=ref,
        maxspeed_kmh=parse_maxspeed(tags.get("maxspeed")),
        roundabout=tags.get("junction") in ROUNDABOUT_JUNCTIONS,
        node_ids=table[:, 0].astype(np.int64),
        lonlat=table[:, 1:].astype(np.float64),
        built_up=is_built_up_by_tags(tags),
        no_fun=is_fun_blocked(tags),
        highway=tags.get("highway", ""),
        narrow=is_narrow(tags),
        promoted_unverified=paved and local_class != road_class and not has_paved_tag(tags),
        paved_tag=has_paved_tag(tags),
        closed_part_of_year=is_closed_part_of_the_year(tags),
        destination_only=is_destination_only(tags),
        oneway=OneWay.YES if direction else OneWay.NO,
    )


def _is_fresh(target: Path, source: Path) -> bool:
    return target.exists() and target.stat().st_mtime > source.stat().st_mtime


def _run(command: list[str]) -> None:
    print("$", " ".join(command), flush=True)
    subprocess.run(command, check=True)
