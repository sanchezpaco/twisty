import json
from types import SimpleNamespace

import numpy as np
import osmium
import pytest

from twisty_pipeline import export, osm


def test_meta_names_the_licence_the_attribution_and_the_data_date(tmp_path):
    graph = SimpleNamespace(node_lonlat=np.array([[-1.0, 40.0], [2.0, 42.0]]), edge_from=np.array([0]))
    export.write_meta(tmp_path / "meta.json", [tmp_path / "spain-latest.osm.pbf", tmp_path / "canary-islands-latest.osm.pbf"], "2026-10-12T20:21:35Z", graph, 3)
    meta = json.loads((tmp_path / "meta.json").read_text())
    assert meta["license"] == "ODbL-1.0"
    assert meta["attribution"] == "© OpenStreetMap contributors"
    assert meta["dataAsOf"] == "2026-10-12T20:21:35Z"
    assert meta["source"] == "spain-latest.osm.pbf + canary-islands-latest.osm.pbf"
    assert meta["bounds"] == [-1.0, 40.0, 2.0, 42.0]


def test_licence_notice_names_the_files_the_source_and_where_to_get_a_copy(tmp_path):
    export.write_license(tmp_path / "LICENSE.txt", [tmp_path / "spain-latest.osm.pbf", tmp_path / "canary-islands-latest.osm.pbf"], "2026-10-12T20:21:35Z")
    text = (tmp_path / "LICENSE.txt").read_text()
    for part in ("graph.bin, candidates.bin, places.json, overlay/", "Open Database License 1.0", "spain-latest.osm.pbf, canary-islands-latest.osm.pbf, data as of 2026-10-12T20:21:35Z"):
        assert part in text
    assert f"A free copy: {export.ROAD_DATA_DOWNLOAD_URL}" in text


def test_data_date_is_the_extract_replication_timestamp(tmp_path):
    header = osmium.io.Header()
    header.set("osmosis_replication_timestamp", "2026-10-12T20:21:35Z")
    writer = osmium.SimpleWriter(str(tmp_path / "extract.osm.pbf"), header=header)
    writer.add_node(osmium.osm.mutable.Node(id=1, location=(-1.0, 40.0)))
    writer.close()
    assert osm.data_as_of(tmp_path / "extract.osm.pbf") == "2026-10-12T20:21:35Z"


def test_an_extract_without_a_date_is_refused(tmp_path):
    writer = osmium.SimpleWriter(str(tmp_path / "undated.osm.pbf"))
    writer.add_node(osmium.osm.mutable.Node(id=1, location=(-1.0, 40.0)))
    writer.close()
    with pytest.raises(ValueError, match="no timestamp"):
        osm.data_as_of(tmp_path / "undated.osm.pbf")
