"""CLI: `python -m twisty_pipeline build --input spain-latest.osm.pbf`."""

import argparse
import time
from contextlib import contextmanager
from pathlib import Path

from . import export, osm
from .builtup import mark_built_up
from .chains import build_chains, curve_fun_by_way
from .graph import build_layers
from .places import PLACE_FILTER, read_places, with_context
from .roads import with_town_one_ways
from .twisties import find_twisties

REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    parser = argparse.ArgumentParser(prog="twisty_pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="Build twisties and routing graph from an OSM extract")
    build.add_argument("--input", type=Path, nargs="+", required=True, help="OSM .pbf extracts, merged when several")
    build.add_argument("--work-dir", type=Path, default=REPO_ROOT / "data" / "interim")
    build.add_argument("--output", type=Path, default=REPO_ROOT / "app" / "public" / "data")
    args = parser.parse_args()
    run_build(args.input, args.work_dir, args.output)


def run_build(sources: list[Path], work_dir: Path, output: Path) -> None:
    # The oldest extract dates the data: nothing in it is newer than that everywhere. Read first, to fail before the build.
    as_of = min(osm.data_as_of(extract) for extract in sources)
    with step("Merging extracts"):
        source = osm.merged(sources, work_dir)
    with step("Pre-filtering roads"):
        located = osm.prefilter(source, work_dir)
    with step("Collecting places"):
        places = read_places(osm.extract(source, work_dir, "places", PLACE_FILTER))
        print(f"  {len(places):,} places")
    with step("Collecting waterways"):
        waterways = osm.extract(source, work_dir, "waterways", "w/waterway=river,canal")
    with step("Reading ways"):
        flags = osm.read_node_flags(located, waterways)
        ways = mark_built_up(osm.read_ways(located, flags), places)
        print(f"  {len(ways):,} ways, {sum(way.built_up for way in ways):,} built up")
    with step("Detecting twisties"):
        chains = build_chains(ways)
        twisties = find_twisties(chains)
        print(f"  {len(chains):,} roads, {len(twisties):,} twisties")
    with step("Building routing graph"):
        connectors = osm.read_connectors(located, ways, chains, flags)
        print(f"  {len(connectors):,} residential links to the dead ends of roads")
        graph, tracks = build_layers(with_town_one_ways([*ways, *connectors]), curve_fun_by_way(chains))
        for layer, label in ((graph, "roads"), (tracks, "tracks")):
            print(f"  {label}: {len(layer.node_lonlat):,} nodes, {len(layer.edge_from):,} edges")
    with step("Writing output"):
        output.mkdir(parents=True, exist_ok=True)
        export.write_graph(graph, output / "graph.bin")
        export.write_graph(tracks, output / "tracks.bin")
        export.write_twisties(twisties, work_dir / "twisties.json")
        export.write_places(with_context(places), output / "places.json")
        export.write_meta(output / "meta.json", sources, as_of, graph, len(twisties))
        export.write_license(output / "LICENSE.txt", sources, as_of)
        for file in sorted(output.iterdir()):
            print(f"  {file.name}: {file.stat().st_size / 1e6:.1f} MB")


@contextmanager
def step(title: str):
    print(f"▸ {title}", flush=True)
    started = time.perf_counter()
    yield
    print(f"  done in {time.perf_counter() - started:.1f}s", flush=True)


if __name__ == "__main__":
    main()
