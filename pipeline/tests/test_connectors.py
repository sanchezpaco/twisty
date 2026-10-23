import numpy as np

from twisty_pipeline.connectors import (
    CONNECTOR_MAX_M,
    cells_around,
    connector_streets,
    dead_end_node_ids,
    in_cells,
    length_m,
    network_node_ids,
)
from twisty_pipeline.chains import build_chains
from twisty_pipeline.osm import cut_ways
from twisty_pipeline.roads import RoadClass, Way

LON_STEP = 0.01  # about 820 m at this latitude


def make_way(way_id, node_ids, name=None, ref=None, road_class=RoadClass.TERTIARY, step=LON_STEP):
    lonlat = np.array([[i * step, 42.0] for i in range(len(node_ids))])
    return Way(way_id, road_class, name, ref, None, False, np.array(node_ids, dtype=np.int64), lonlat)


# Nodes 1 .. 4 are a road, which meets a second one at 4 (4 .. 6); each stops at its far end, 1 and 6.
ROAD = make_way(1, [1, 2, 3, 4], ref="BV-5227")
THROUGH = make_way(2, [4, 5, 6], ref="C-17")


def test_a_dead_end_is_where_a_long_named_road_ends_and_nothing_else_goes_through():
    ways = [ROAD, THROUGH]
    assert dead_end_node_ids(ways, build_chains(ways)) == {1, 6}


def test_a_road_is_as_long_as_its_ways_together_not_as_long_as_one_of_them():
    # Vidrà: 22 km of road mapped as a dozen ways of a kilometre each.
    pieces = [make_way(i, [i * 10 + 1, i * 10 + 2, (i + 1) * 10 + 1], name="Carretera de Vidrà", step=0.007) for i in range(4)]
    assert dead_end_node_ids(pieces, build_chains(pieces)) == {1, 41}


def test_a_short_tail_of_a_long_road_cut_off_by_a_bridge_is_still_the_road():
    tail = make_way(1, [1, 2], name="Carretera de Vidrà", step=0.01)
    bridge = make_way(2, [2, 3], name="Pont de les Escanes", step=0.0003)
    road = make_way(3, [3, 4, 5], name="Carretera de Vidrà", step=0.01)
    assert dead_end_node_ids([tail, bridge, road], build_chains([tail, bridge, road])) == {1, 5}


def test_a_road_of_the_same_name_far_away_is_another_road():
    near = make_way(1, [1, 2], name="Carretera Vieja", step=0.007)
    far = make_way(2, [3, 4], name="Carretera Vieja", step=0.007)
    far.lonlat[:, 0] += 3.0
    assert dead_end_node_ids([near, far], build_chains([near, far])) == set()


def test_a_short_or_nameless_way_makes_no_dead_end_worth_a_link():
    ways = [make_way(3, [7, 8], ref="X-1", step=0.001), make_way(4, [9, 10, 11])]
    assert dead_end_node_ids(ways, build_chains(ways)) == set()


NETWORK = network_node_ids([ROAD, THROUGH])


def ids(streets):
    return sorted(street.id for street in streets)


def test_a_street_between_a_dead_end_and_the_network_is_a_connector():
    assert ids(connector_streets([make_way(5, [1, 4], step=0.003)], {1}, NETWORK)) == [5]
    assert ids(connector_streets([make_way(5, [4, 1], step=0.003)], {1}, NETWORK)) == [5]


def test_two_streets_chained_between_a_dead_end_and_the_network_are_connectors():
    # La Roda: the road ends 194 m from the network, across two streets.
    streets = [make_way(5, [1, 20], step=0.001), make_way(6, [20, 4], step=0.001)]
    assert ids(connector_streets(streets, {1}, NETWORK)) == [5, 6]


def test_a_street_that_does_not_reach_the_network_is_not():
    assert connector_streets([make_way(5, [1, 99], step=0.003)], {1}, NETWORK) == []


def test_streets_together_longer_than_the_limit_are_not():
    streets = [make_way(5, [1, 20], step=0.004), make_way(6, [20, 4], step=0.004)]
    assert connector_streets(streets, {1}, NETWORK) == []


def test_a_direct_street_is_kept_even_when_a_chain_of_streets_is_shorter():
    streets = [make_way(5, [1, 4], step=0.005), make_way(6, [1, 20], step=0.001), make_way(7, [20, 4], step=0.001)]
    assert ids(connector_streets(streets, {1}, NETWORK)) == [5]


def test_chained_streets_are_kept_only_when_no_street_reaches_the_network_directly():
    streets = [make_way(6, [1, 20], step=0.001), make_way(7, [20, 4], step=0.001), make_way(8, [20, 21], step=0.001)]
    assert ids(connector_streets(streets, {1}, NETWORK)) == [6, 7]


def test_a_dead_end_with_two_links_to_the_network_keeps_both():
    # Toses: a road ends in a village whose two streets reach the network, so the dead end joins both sides.
    streets = [make_way(5, [1, 4], step=0.001), make_way(6, [1, 6], step=0.001)]
    assert ids(connector_streets(streets, {1}, NETWORK)) == [5, 6]


def test_a_street_network_is_not_a_connector():
    assert connector_streets([make_way(5, [1, 4], step=0.01)], {1}, NETWORK) == []


def test_a_street_between_two_ordinary_nodes_is_not_a_connector():
    assert connector_streets([make_way(5, [2, 5], step=0.003)], {1}, NETWORK) == []


def test_a_loop_back_to_the_dead_end_is_not_a_connector():
    assert connector_streets([make_way(5, [1, 7, 1], step=0.001)], {1}, NETWORK) == []


def test_a_dead_end_meets_the_network_halfway_along_a_street():
    # CV-712 in la Vall d'Ebo: one run ends at the last node of a street, the other at the node before.
    links = connector_streets([make_way(5, [99, 6, 1], step=0.0001)], {1, 6}, NETWORK)
    assert [link.node_ids.tolist() for link in links] == [[99, 6, 1]]


def test_a_short_street_past_the_network_is_kept_whole():
    # The arc of a village roundabout two roads meet on, past the node where the dead end's road joins it.
    links = connector_streets([make_way(5, [1, 4, 6], step=0.001)], {1}, NETWORK)
    assert [link.node_ids.tolist() for link in links] == [[1, 4, 6]]


def test_a_long_street_past_the_network_is_kept_only_up_to_it():
    links = connector_streets([make_way(5, [1, 4, 6], step=0.004)], {1}, NETWORK)
    assert [link.node_ids.tolist() for link in links] == [[1, 4]]


def test_a_gate_on_a_street_before_the_network_stops_the_link():
    assert connector_streets(cut_ways([make_way(5, [1, 7, 4], step=0.001)], np.array([7])), {1}, NETWORK) == []


def test_a_street_is_looked_for_in_the_cells_around_a_dead_end():
    cells = cells_around([ROAD, THROUGH], {1})
    assert in_cells(0.0, 42.0, cells)
    assert in_cells(-0.009, 41.991, cells)
    assert not in_cells(0.02, 42.0, cells)


def old_rule(street, dead_ends, network):
    first, last = int(street.node_ids[0]), int(street.node_ids[-1])
    return first != last and length_m(street.lonlat) <= CONNECTOR_MAX_M and (
        (first in dead_ends and last in network) or (last in dead_ends and first in network)
    )


def test_every_street_a_dead_end_had_a_direct_link_by_is_still_kept():
    rng = np.random.default_rng(7)
    network_nodes = set(range(1, 9))
    for _ in range(200):
        streets = []
        for way_id in range(rng.integers(3, 12)):
            first, last = rng.choice(np.arange(1, 16), size=2, replace=False)
            streets.append(make_way(way_id + 10, [int(first), int(last)], step=float(rng.choice([0.001, 0.003, 0.005, 0.009]))))
        dead_ends = {int(node) for node in rng.choice(np.arange(1, 9), size=3, replace=False)}
        network = np.array(sorted(network_nodes))
        before = {street.id for street in streets if old_rule(street, dead_ends, network_nodes)}
        assert before <= {street.id for street in connector_streets(streets, dead_ends, network)}
