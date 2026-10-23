import numpy as np

from twisty_pipeline.chains import build_chains
from twisty_pipeline.roads import RoadClass, Way


def make_way(way_id, node_ids, ref="CL-505", road_class=RoadClass.SECONDARY, lonlat=None):
    lonlat = np.array([[float(n), 0.0] for n in node_ids]) if lonlat is None else np.array(lonlat)
    return Way(way_id, road_class, None, ref, None, False, np.array(node_ids, dtype=np.int64), lonlat)


def test_ways_of_same_road_are_joined_regardless_of_direction():
    chains = build_chains([make_way(1, [1, 2, 3]), make_way(2, [5, 4, 3]), make_way(3, [0, 1])])
    assert len(chains) == 1
    assert chains[0].node_ids.tolist() in ([0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0])


def test_different_roads_are_not_joined():
    chains = build_chains([make_way(1, [1, 2, 3]), make_way(2, [3, 4], ref="N-110")])
    assert sorted(len(chain.node_ids) for chain in chains) == [2, 3]


def test_chain_breaks_where_road_branches_at_a_right_angle():
    side = make_way(3, [2, 4], lonlat=[[2.0, 0.0], [2.0, 1.0]])
    chains = build_chains([make_way(1, [1, 2]), make_way(2, [2, 3]), side])
    assert sorted(len(chain.node_ids) for chain in chains) == [2, 3]


def test_a_road_goes_on_along_one_carriageway_where_it_splits_in_two():
    # 1 - 2, then two carriageways 2 - 3 - 5 (north) and 2 - 4 - 5 (south) that meet again at 5, and 5 - 6.
    ways = [
        make_way(1, [1, 2], lonlat=[[0.0, 0.0], [1.0, 0.0]]),
        make_way(2, [2, 3, 5], lonlat=[[1.0, 0.0], [2.0, 0.01], [3.0, 0.0]]),
        make_way(3, [2, 4, 5], lonlat=[[1.0, 0.0], [2.0, -0.01], [3.0, 0.0]]),
        make_way(4, [5, 6], lonlat=[[3.0, 0.0], [4.0, 0.0]]),
    ]
    chains = build_chains(ways)
    assert sorted(len(chain.node_ids) for chain in chains) == [3, 5]


def test_at_a_t_the_bar_goes_straight_on_and_the_stem_is_a_chain_of_its_own():
    bar_north = make_way(2, [2, 3], lonlat=[[1.0, 0.0], [1.0, 1.0]])
    bar_south = make_way(3, [2, 4], lonlat=[[1.0, 0.0], [1.0, -1.0]])
    chains = build_chains([make_way(1, [1, 2]), bar_north, bar_south])
    assert sorted(len(chain.node_ids) for chain in chains) == [2, 3]


def test_a_y_junction_pairs_the_straight_way_whatever_the_order_of_the_ways():
    # 1 - 2 arrives from the west; 2 - 3 goes straight on east; 2 - 4 branches 45 degrees to the north-east.
    stem = make_way(1, [1, 2], lonlat=[[0.0, 0.0], [1.0, 0.0]])
    straight = make_way(2, [2, 3], lonlat=[[1.0, 0.0], [2.0, 0.0]])
    branch = make_way(3, [2, 4], lonlat=[[1.0, 0.0], [2.0, 1.0]])
    for ways in ([stem, straight, branch], [branch, stem, straight], [branch, straight, stem]):
        chains = build_chains(ways)
        assert sorted(chain.node_ids.tolist() in ([1, 2, 3], [3, 2, 1]) for chain in chains) == [False, True]
        assert sorted(len(chain.node_ids) for chain in chains) == [2, 3]
