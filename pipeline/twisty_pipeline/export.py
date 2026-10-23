"""Writing pipeline results in the formats the app loads."""

import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

from . import polyline
from .geo import project_to_meters, simplify_indices
from .graph import RoutingGraph
from .places import Place
from .twisties import Twisty

GRAPH_MAGIC = b"TWG5"
TWISTY_GEOMETRY_TOLERANCE_M = 4.0
# Where the shipped data of each version can be downloaded free, as ODbL 4.6 asks: a release of the public repository.
ROAD_DATA_DOWNLOAD_URL = "https://github.com/sanchezpaco/twisty/releases"
LICENSE = "ODbL-1.0"
ATTRIBUTION = "© OpenStreetMap contributors"


def write_graph(graph: RoutingGraph, path: Path) -> None:
    """Little-endian binary layout, every numeric section 4-byte aligned:

    magic 'TWG5' | u32 nodeCount | u32 edgeCount | u32 geometryPointCount | u32 roadNamesBytes
    f32 nodeLonLat[2N] | u32 edgeFrom[E] | u32 edgeTo[E] | f32 edgeTimeS[E] | f32 edgeLengthM[E] | f32 edgeFunM[E]
    u32 edgeRoad[E] | u32 edgeGeometryOffset[E+1] | f32 geometryLonLat[2G] | u8 edgeClass[E]
    u8 edgeNarrow[E] (share of the edge's length that is narrow, 0..255) | u8 edgePostedKmh[E] (0 = none or above 40)
    | u8 edgeFords[E] (ford nodes on the edge) | u8 edgeOneway[E] (0 two-way, 1 only from edgeFrom to edgeTo, 2 a town's
    one-way street ridden both ways) | u8 edgeHeading[2E] (riding from -> to: the heading leaving edgeFrom and arriving at
    edgeTo, in 1/256 turns anticlockwise from east) | u8 edgeFlags[E] (graph.EdgeFlag bits: 1 closed part of the year,
    2 destination only, 4 built up)
    utf-8 JSON array of road names (roadNamesBytes)

    A stacked layer (tracks) uses the same layout; its node and road indices continue the base layer's.
    """
    counts = np.array([len(points) for points in graph.edge_geometry], dtype=np.uint32)
    offsets = np.concatenate([[0], np.cumsum(counts)]).astype("<u4")
    geometry = np.concatenate([points for points in graph.edge_geometry if len(points)] or [np.zeros((0, 2))])
    names = json.dumps(graph.road_names, ensure_ascii=False, separators=(",", ":")).encode()
    header = np.array([len(graph.node_lonlat), len(graph.edge_from), len(geometry), len(names)], dtype="<u4")
    sections = [
        header,
        graph.node_lonlat.astype("<f4"),
        graph.edge_from.astype("<u4"),
        graph.edge_to.astype("<u4"),
        graph.edge_time_s.astype("<f4"),
        graph.edge_length_m.astype("<f4"),
        graph.edge_fun_m.astype("<f4"),
        graph.edge_road.astype("<u4"),
        offsets,
        geometry.astype("<f4"),
        graph.edge_class.astype("u1"),
        graph.edge_narrow.astype("u1"),
        graph.edge_posted_kmh.astype("u1"),
        graph.edge_fords.astype("u1"),
        graph.edge_oneway.astype("u1"),
        graph.edge_heading.astype("u1"),
        graph.edge_flags.astype("u1"),
    ]
    with path.open("wb") as file:
        file.write(GRAPH_MAGIC)
        for section in sections:
            file.write(np.ascontiguousarray(section).tobytes())
        file.write(names)


def write_twisties(twisties: list[Twisty], path: Path) -> None:
    records = [_twisty_record(index, twisty) for index, twisty in enumerate(twisties)]
    path.write_text(json.dumps({"twisties": records}, separators=(",", ":")))


def write_places(places: list[Place], path: Path) -> None:
    """Rows of [name, kind, lon, lat, context]; ~10 m precision is plenty to start a route from."""
    rows = [[p.name, p.kind, round(p.lon, 4), round(p.lat, 4), p.context] for p in places]
    path.write_text(json.dumps({"places": rows}, ensure_ascii=False, separators=(",", ":")))


def write_meta(path: Path, sources: list[Path], data_as_of: str, graph: RoutingGraph, twisty_count: int) -> None:
    lon, lat = graph.node_lonlat[:, 0], graph.node_lonlat[:, 1]
    meta = {
        "version": 2,
        "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        "source": " + ".join(source.name for source in sources),
        "dataAsOf": data_as_of,
        "license": LICENSE,
        "attribution": ATTRIBUTION,
        "nodes": len(graph.node_lonlat),
        "edges": len(graph.edge_from),
        "twisties": twisty_count,
        "bounds": [float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max())],
    }
    path.write_text(json.dumps(meta, indent=2, ensure_ascii=False))


def write_license(path: Path, sources: list[Path], data_as_of: str) -> None:
    """The notice ODbL 4.2(d) asks for next to the derived databases the app ships."""
    path.write_text(
        "Twisty road data (graph.bin, candidates.bin, places.json, overlay/) is a Derivative Database of OpenStreetMap,\n"
        f"{ATTRIBUTION}, available under the Open Database License 1.0,\n"
        "https://opendatacommons.org/licenses/odbl/1-0/.\n"
        f"Source: Geofabrik {', '.join(source.name for source in sources)}, data as of {data_as_of};\n"
        "see https://www.openstreetmap.org/copyright.\n"
        "Twisty's additions (fun scores, curvature, twisty chains, place ranking) are released under the same licence.\n"
        f"A free copy: {ROAD_DATA_DOWNLOAD_URL}\n"
    )


def _twisty_record(twisty_id: int, twisty: Twisty) -> dict:
    kept = simplify_indices(project_to_meters(twisty.lonlat), TWISTY_GEOMETRY_TOLERANCE_M)
    return {
        "id": twisty_id,
        "name": twisty.name,
        "ref": twisty.ref,
        "lengthM": round(twisty.length_m),
        "twist": round(twisty.twist_deg_per_km),
        "rating": twisty.rating,
        "line": polyline.encode(twisty.lonlat[kept]),
    }
