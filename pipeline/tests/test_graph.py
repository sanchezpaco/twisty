from dataclasses import replace

import numpy as np
from conftest import straight_road, zigzag_road

from twisty_pipeline import graph as graph_module
from twisty_pipeline.chains import build_chains, curve_fun_by_way, way_key
from twisty_pipeline.curvature import cumulative_fun_m, turning_profile
from twisty_pipeline.graph import RoutingGraph, build_graph, build_layers, junction_node_ids, renumbered
from twisty_pipeline.roads import BASE_SPEED_KMH, OneWay, RoadClass, Way, fun_weight, with_town_one_ways
from twisty_pipeline.twisties import find_twisties


def make_way(way_id, node_ids, road_class, name=None, maxspeed_kmh=None, narrow=False, ford_positions=(), oneway=False, lonlat=None):
    lonlat = np.array([[n * 0.01, 0.0] for n in node_ids]) if lonlat is None else np.array(lonlat)
    return Way(way_id, road_class, name, None, maxspeed_kmh, False, np.array(node_ids, dtype=np.int64), lonlat, narrow=narrow,
               ford_positions=ford_positions, oneway=OneWay.YES if oneway else OneWay.NO)


def _edges(graph):
    """(from, to, one-way) of every edge, in OSM ids."""
    return sorted((int(graph.node_ids[a]), int(graph.node_ids[b]), bool(o)) for a, b, o in zip(graph.edge_from, graph.edge_to, graph.edge_oneway))


def test_a_one_way_edge_runs_from_where_it_may_be_entered(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # A loop: 1 -> 2 -> 3 one-way, back from 3 to 1 on a two-way road.
    ways = [
        make_way(1, [1, 2], RoadClass.SECONDARY, "N-1", oneway=True),
        make_way(2, [2, 3], RoadClass.SECONDARY, "N-1", oneway=True),
        make_way(3, [3, 6, 1], RoadClass.SECONDARY, "N-2"),
        make_way(4, [2, 7], RoadClass.TERTIARY, "CV-1"),
        make_way(5, [7, 3], RoadClass.TERTIARY, "CV-1"),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    assert _edges(roads) == [(1, 2, True), (2, 3, False), (2, 3, True), (3, 1, False)]


def test_a_road_is_not_merged_where_its_direction_changes(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # N-1 is one-way from 1 to 2, two-way from 2 to 3; N-2 is one-way out of both of its ends towards 5.
    ways = [
        make_way(1, [1, 2], RoadClass.SECONDARY, "N-1", oneway=True),
        make_way(2, [2, 3], RoadClass.SECONDARY, "N-1"),
        make_way(3, [3, 1], RoadClass.TERTIARY, "CV-1"),
        make_way(4, [1, 5], RoadClass.SECONDARY, "N-2", oneway=True),
        make_way(5, [3, 5], RoadClass.SECONDARY, "N-2", oneway=True),
        make_way(6, [5, 1], RoadClass.TERTIARY, "CV-2"),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    assert (1, 2, True) in _edges(roads) and (2, 3, False) in _edges(roads)
    assert (1, 5, True) in _edges(roads) and (3, 5, True) in _edges(roads)


def test_one_way_edges_in_a_row_are_merged_the_way_they_are_ridden(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    ways = [
        make_way(1, [2, 3], RoadClass.SECONDARY, "N-1", oneway=True),
        make_way(2, [1, 2], RoadClass.SECONDARY, "N-1", oneway=True),
        make_way(3, [3, 1], RoadClass.TERTIARY, "CV-1"),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    assert _edges(roads) == [(1, 3, True), (3, 1, False)]


def test_edges_carry_their_heading_at_both_ends(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # East out of 1, a bend, and north into 3; a short two-way road back.
    ways = [
        make_way(1, [1, 2, 3], RoadClass.PRIMARY, "N-1", oneway=True, lonlat=[[0.0, 0.0], [0.01, 0.0], [0.01, 0.01]]),
        make_way(2, [3, 1], RoadClass.TERTIARY, "CV-1", lonlat=[[0.01, 0.01], [0.0, 0.0]]),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    one_way = int(np.flatnonzero(roads.edge_oneway)[0])
    assert roads.edge_heading[one_way].tolist() == [0, 64]


def test_the_one_way_streets_of_a_town_are_ridden_both_ways_but_not_its_carriageways():
    street = replace(make_way(1, [1, 2], RoadClass.TERTIARY, "Calle Mayor", oneway=True), built_up=True)
    trunk = replace(make_way(2, [3, 4], RoadClass.TRUNK, "N-2", oneway=True), built_up=True)
    outside = make_way(3, [5, 6], RoadClass.TERTIARY, "CV-3", oneway=True)
    assert [way.oneway for way in with_town_one_ways([street, trunk, outside])] == [OneWay.IN_TOWN, OneWay.YES, OneWay.YES]


def test_nodes_a_rider_can_enter_but_not_leave_are_dropped(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 3)
    # A two-way triangle 1-2-3, and a one-way street from 3 into a dead end at 4.
    ways = [
        make_way(1, [1, 2], RoadClass.TERTIARY, "CV-1"),
        make_way(2, [2, 3], RoadClass.TERTIARY, "CV-2"),
        make_way(3, [3, 1], RoadClass.TERTIARY, "CV-3"),
        make_way(4, [3, 4], RoadClass.UNCLASSIFIED, "Carrer", oneway=True),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    assert sorted(roads.node_ids.tolist()) == [1, 2, 3]
    assert len(roads.edge_from) == 3


def test_tracks_form_a_layer_stacked_on_the_road_network(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    ways = [
        make_way(1, [1, 2, 3], RoadClass.TERTIARY, "CV-35"),
        make_way(2, [3, 4], RoadClass.TERTIARY, "CV-35"),
        make_way(3, [3, 5, 6], RoadClass.TRACK, "Pista del Collado"),
    ]
    roads, tracks = build_layers(ways)

    # Without tracks, node 3 only continues CV-35: the road network is a single edge from 1 to 4.
    assert roads.node_ids.tolist() == [1, 4]
    assert roads.edge_class.tolist() == [RoadClass.TERTIARY]
    assert roads.road_names == ["", "CV-35"]

    # The layer adds nodes 3 and 6 after the road nodes, the track, and CV-35 split at the track junction.
    assert tracks.node_ids.tolist() == [3, 6]
    stretches = sorted(zip(tracks.edge_class.tolist(), map(sorted, zip(tracks.edge_from, tracks.edge_to))))
    assert stretches == [(RoadClass.TERTIARY, [0, 2]), (RoadClass.TERTIARY, [1, 2]), (RoadClass.TRACK, [2, 3])]
    assert tracks.road_names == ["Pista del Collado"]
    assert sorted(tracks.edge_road.tolist()) == [1, 1, 2]


def test_renumbering_keeps_the_graph_and_puts_neighbours_next_to_each_other():
    nodes = [(lon, lat) for lat in range(8) for lon in range(8)]
    ids = np.arange(len(nodes)) + 100
    grid = {pos: i for i, pos in enumerate(nodes)}
    edges = [(grid[(x, y)], grid[(x + 1, y)]) for y in range(8) for x in range(7)]
    original = RoutingGraph(
        node_ids=ids,
        node_lonlat=np.array(nodes, dtype=float),
        edge_from=np.array([a for a, _ in edges]),
        edge_to=np.array([b for _, b in edges]),
        edge_time_s=np.arange(len(edges), dtype=float),
        edge_length_m=np.ones(len(edges)),
        edge_fun_m=np.zeros(len(edges)),
        edge_class=np.full(len(edges), RoadClass.TERTIARY, dtype=np.uint8),
        edge_narrow=np.zeros(len(edges), dtype=np.uint8),
        edge_posted_kmh=np.zeros(len(edges), dtype=np.uint8),
        edge_fords=np.zeros(len(edges), dtype=np.uint8),
        edge_oneway=np.zeros(len(edges), dtype=np.uint8),
        edge_heading=np.zeros((len(edges), 2), dtype=np.uint8),
        edge_flags=np.arange(len(edges), dtype=np.uint8),
        edge_road=np.zeros(len(edges), dtype=np.int64),
        edge_geometry=[np.array([[float(i), 0.0]]) for i in range(len(edges))],
        road_names=[""],
    )
    result = renumbered(original)

    def as_set(graph):
        return {
            (graph.node_ids[a], graph.node_ids[b], t, tuple(g[0]))
            for a, b, t, g in zip(graph.edge_from, graph.edge_to, graph.edge_time_s, graph.edge_geometry)
        }

    assert as_set(result) == as_set(original)
    assert sorted(result.node_ids) == sorted(original.node_ids)
    assert np.all(np.diff(np.minimum(result.edge_from, result.edge_to)) >= 0)
    # Consecutive numbers are a short walk apart on the map, unlike the row-by-row numbering of the input.
    steps = np.abs(np.diff(result.node_lonlat, axis=0)).sum(axis=1)
    assert steps.max() <= 2 and steps.mean() < 1.2


def test_a_stacked_layer_keeps_the_road_node_numbers_and_numbers_its_own_nodes_after_them(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    ways = [
        make_way(1, [30, 20, 10], RoadClass.TERTIARY, "A-1"),
        make_way(2, [10, 40], RoadClass.TERTIARY, "A-2"),
        make_way(3, [10, 50, 60], RoadClass.TRACK, "Pista"),
        make_way(4, [60, 70], RoadClass.TRACK, "Pista"),
        make_way(5, [10, 80], RoadClass.TRACK, "Pista"),
    ]
    roads, tracks = build_layers(ways)
    nodes = np.concatenate([roads.node_ids, tracks.node_ids])
    assert sorted(roads.node_ids.tolist()) == [10, 30, 40]
    assert sorted(tracks.node_ids.tolist()) == [70, 80]
    track_edges = {
        frozenset((nodes[a].item(), nodes[b].item()))
        for a, b, c in zip(tracks.edge_from, tracks.edge_to, tracks.edge_class)
        if c == RoadClass.TRACK
    }
    assert track_edges == {frozenset((10, 70)), frozenset((10, 80))}


def test_edges_carry_how_much_of_them_is_narrow_and_the_lowest_limit_posted(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    ways = [
        make_way(1, [1, 2], RoadClass.TERTIARY, "CV-35", maxspeed_kmh=40.0),
        make_way(2, [2, 3], RoadClass.TERTIARY, "CV-35", maxspeed_kmh=30.0, narrow=True),
        make_way(3, [3, 4], RoadClass.TERTIARY, "CV-35"),
        make_way(4, [3, 5], RoadClass.TERTIARY, "CV-90", maxspeed_kmh=50.0),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    by_road = {}
    for road, narrow, posted in zip(roads.edge_road, roads.edge_narrow, roads.edge_posted_kmh):
        by_road.setdefault(roads.road_names[road], []).append((int(narrow), int(posted)))
    # CV-35 is merged through node 2: half of it narrow, 30 the lowest limit; its other edge and CV-90 carry nothing.
    assert by_road["CV-90"] == [(0, 0)]
    plain, merged = sorted(by_road["CV-35"])
    assert plain == (0, 0)
    assert abs(merged[0] - 127.5) <= 1 and merged[1] == 30


def test_edges_count_the_ford_nodes_they_go_through(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # CV-35 runs 1 - 2 - 3 - 4 with fords at nodes 2 and 3; node 3 is where CV-90 branches off, so it ends an edge.
    ways = [
        make_way(1, [1, 2, 3], RoadClass.TERTIARY, "CV-35", ford_positions=(1, 2)),
        make_way(2, [3, 4], RoadClass.TERTIARY, "CV-35"),
        make_way(3, [3, 5], RoadClass.TERTIARY, "CV-90"),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    counts = {roads.road_names[road]: int(fords) for road, fords in zip(roads.edge_road, roads.edge_fords)}
    assert counts["CV-90"] == 0
    assert sorted(int(fords) for road, fords in zip(roads.edge_road, roads.edge_fords) if roads.road_names[road] == "CV-35") == [0, 2]


def test_edges_carry_their_ways_flags_and_do_not_merge_across_a_change(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # Ma-2210 runs 1 - 2 - 3 - 4: the way from 2 to 4 closes in summer, so the road is two edges, not one.
    ways = [
        make_way(1, [1, 2], RoadClass.SECONDARY, "Ma-2210"),
        replace(make_way(2, [2, 3, 4], RoadClass.SECONDARY, "Ma-2210"), closed_part_of_year=True, built_up=True),
        replace(make_way(3, [4, 5], RoadClass.TERTIARY, "Camino de Ronda a Setenil"), destination_only=True),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    by_road = sorted((roads.road_names[road], round(float(length) / 1000), int(flag)) for road, length, flag in zip(roads.edge_road, roads.edge_length_m, roads.edge_flags))
    flag = graph_module.EdgeFlag
    assert by_road == [("Camino de Ronda a Setenil", 1, flag.DESTINATION_ONLY), ("Ma-2210", 1, 0), ("Ma-2210", 2, flag.CLOSED_PART_OF_YEAR | flag.BUILT_UP)]


def test_a_road_runs_on_through_a_town_as_one_edge_built_up_by_most_of_its_length(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # C-28 runs 1 - 2 - 4 - 5 through Esterri: 1 km open road, then 2 km of town.
    def road(town_km):
        ways = [make_way(1, [1, 2], RoadClass.SECONDARY, "C-28"), replace(make_way(2, [2, 3, 4][: town_km + 1], RoadClass.SECONDARY, "C-28"), built_up=True)]
        return graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    assert road(2).edge_flags.tolist() == [graph_module.EdgeFlag.BUILT_UP]
    assert road(1).edge_flags.tolist() == [0]


def test_a_ford_node_where_two_ways_meet_counts_once(monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # A-399 is two ways that meet at the ford node 2: the first ends on it, the second starts on it.
    ways = [
        make_way(1, [1, 2], RoadClass.TERTIARY, "A-399", ford_positions=(1,)),
        make_way(2, [2, 3], RoadClass.TERTIARY, "A-399", ford_positions=(0,)),
    ]
    roads = graph_module.build_graph(ways, graph_module.junction_node_ids(ways))
    assert int(roads.edge_fords.sum()) == 1


def _curvy_ways(to_lonlat, cut_every, reverse_second=False, no_fun_index=None, town_index=None):
    """One curvy road as consecutive ways of `cut_every` vertices; the second way may be mapped the other way round."""
    lonlat = to_lonlat(zigzag_road(6_000))
    ids = np.arange(1, len(lonlat) + 1, dtype=np.int64)
    ways, start, index = [], 0, 0
    while start < len(lonlat) - 1:
        end = min(start + cut_every, len(lonlat) - 1)
        node_ids, points = ids[start : end + 1], lonlat[start : end + 1]
        if reverse_second and index == 1:
            node_ids, points = node_ids[::-1], points[::-1]
        gated, town = index == no_fun_index, index == town_index
        limit = 50.0 if town else None
        ways.append(Way(100 + index, RoadClass.TERTIARY, None, "CV-1", limit, False, node_ids, points, town, gated))
        start, index = end, index + 1
    return ways


def _graph(ways, along_chains):
    curve_fun = curve_fun_by_way(build_chains(ways)) if along_chains else None
    return build_graph(ways, junction_node_ids(ways), curve_fun)


def _fun(ways, along_chains):
    return _graph(ways, along_chains).edge_fun_m.sum()


def test_a_road_cut_into_short_ways_keeps_the_fun_it_has_along_the_road(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    whole = _fun(_curvy_ways(to_lonlat, cut_every=10_000), along_chains=False)
    cut = _curvy_ways(to_lonlat, cut_every=40, reverse_second=True)

    assert np.isclose(_fun(cut, along_chains=True), whole)
    # Way by way, every short way's window takes the road beyond its ends as straight.
    assert _fun(cut, along_chains=False) < 0.95 * whole


def test_the_graph_and_the_twisties_give_a_road_the_same_fun(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    cut = _curvy_ways(to_lonlat, cut_every=40, reverse_second=True)
    graph = _graph(cut, along_chains=True)
    [twisty] = find_twisties(build_chains(cut))

    assert np.isclose(twisty.length_m, graph.edge_length_m.sum())
    assert np.isclose(twisty.fun * twisty.length_m, graph.edge_fun_m.sum())


def test_a_gate_on_one_way_of_the_road_zeroes_that_way_only(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    open_road = _fun(_curvy_ways(to_lonlat, cut_every=100), along_chains=True)
    gated = _curvy_ways(to_lonlat, cut_every=100, no_fun_index=2)
    graph_fun = _fun(gated, along_chains=True)

    assert 0 < graph_fun < open_road
    blocked = gated[2]
    blocked_fun = curve_fun_by_way(build_chains(gated))[way_key(blocked)]
    weight = fun_weight(replace(blocked, no_fun=False))
    lost = cumulative_fun_m(turning_profile(blocked.lonlat), blocked_fun)[-1] * weight
    assert np.isclose(open_road - graph_fun, lost)


def test_the_bends_of_a_town_crossing_do_not_feed_the_road_around_it(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    gated = _fun(_curvy_ways(to_lonlat, cut_every=100, no_fun_index=2), along_chains=True)
    town = _fun(_curvy_ways(to_lonlat, cut_every=100, town_index=2), along_chains=True)

    # Both zero their own way; only the gate's bends still count in the windows of the ways next to it.
    assert 0 < town < 0.98 * gated


def _edge_times(xy, cuts, to_lonlat, maxspeed_kmh=None):
    """The edge times of one primary road with junctions at its ends and at the vertices in `cuts`."""
    ids = list(range(1, len(xy) + 1))
    way = make_way(1, ids, RoadClass.PRIMARY, "N-1", maxspeed_kmh=maxspeed_kmh, lonlat=to_lonlat(xy))
    junctions = np.array(sorted({ids[0], ids[-1], *(ids[cut] for cut in cuts)}), dtype=np.int64)
    return build_graph([way], junctions).edge_time_s


def test_where_junctions_cut_a_road_does_not_change_how_long_it_takes(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    road = zigzag_road(3_000)
    whole = _edge_times(road, [], to_lonlat).sum()
    rng = np.random.default_rng(23)
    for _ in range(20):
        cuts = rng.choice(np.arange(1, len(road) - 1), size=rng.integers(1, 12), replace=False)
        assert np.isclose(_edge_times(road, cuts, to_lonlat).sum(), whole, rtol=1e-9)


def test_a_straight_road_is_ridden_at_its_class_or_posted_speed(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    road = straight_road(2_000)
    assert np.isclose(_edge_times(road, [40], to_lonlat).sum(), 2_000 / (BASE_SPEED_KMH[RoadClass.PRIMARY] / 3.6), rtol=1e-3)
    assert np.isclose(_edge_times(road, [40], to_lonlat, maxspeed_kmh=50).sum(), 2_000 / (50 / 3.6), rtol=1e-3)


def test_a_bend_at_a_junction_slows_the_road_on_both_sides(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)

    def main_road_times(xy):
        # A side road at vertex 40 keeps the junction there, so the road stays two edges.
        ids = list(range(1, len(xy) + 1))
        road = make_way(1, ids, RoadClass.PRIMARY, "N-1", lonlat=to_lonlat(xy))
        side = make_way(2, [41, 999], RoadClass.TERTIARY, "CV-1", lonlat=to_lonlat(np.array([xy[40], xy[40] + [-300, 300]])))
        graph = build_graph([road, side], junction_node_ids([road, side]))
        return graph.edge_time_s[graph.edge_class == RoadClass.PRIMARY]

    # 1 km east, then a right angle at the junction and 1 km north: 90 deg/km caps a primary below its 80 km/h.
    corner = main_road_times(np.vstack([straight_road(1_000), straight_road(1_000)[1:, ::-1] + [1_000, 0]]))
    straight = main_road_times(straight_road(2_000))
    assert len(corner) == 2 and (corner > straight).all()


def test_a_roundabout_cut_in_arcs_is_ridden_as_tight_as_it_is(to_lonlat, monkeypatch):
    monkeypatch.setattr(graph_module, "MIN_COMPONENT_NODES", 1)
    # A 30 m radius ring mapped as four arcs: each arc is shorter than the window, and its turning is read over the arc,
    # not spread over a straight the way does not have.
    ring = np.array([[30 * np.cos(a), 30 * np.sin(a)] for a in np.linspace(0, 2 * np.pi, 37)])
    ids = [*range(1, 37), 1]
    arcs = [make_way(10 + k, ids[k * 9 : k * 9 + 10], RoadClass.PRIMARY, "", lonlat=to_lonlat(ring[k * 9 : k * 9 + 10])) for k in range(4)]
    speed_kmh = 2 * np.pi * 30 / build_graph(arcs, junction_node_ids(arcs)).edge_time_s.sum() * 3.6
    assert speed_kmh < 25
