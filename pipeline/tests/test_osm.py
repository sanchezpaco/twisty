import numpy as np

from twisty_pipeline.osm import cut_way, cut_ways, way_from_tags, with_node_flags
from twisty_pipeline.roads import NodeFlags, demote_beside_tracks, RoadClass, Way, node_flags

NO_NODES = np.array([], dtype=np.int64)


def make_way(*node_ids, way_id=7):
    lonlat = np.array([[i * 0.001, 0.0] for i, _ in enumerate(node_ids)])
    return Way(way_id, RoadClass.TERTIARY, None, None, None, False, np.array(node_ids, dtype=np.int64), lonlat)


def table(*node_ids):
    return np.array([[node, i * 0.001, 0.0] for i, node in enumerate(node_ids)])


def flags(blocked=(), gates=(), fords=(), perennial_fords=()):
    return NodeFlags(*(np.array(sorted(ids), dtype=np.int64) for ids in (blocked, gates, fords, perennial_fords)))


def test_a_way_without_blocked_nodes_is_left_alone():
    way = make_way(1, 2, 3)
    assert cut_way(way, np.array([9])) == [way]


def test_a_way_is_cut_at_a_blocked_node_and_the_halves_are_not_joined():
    first, second = cut_way(make_way(1, 2, 3, 4), np.array([3]))
    assert first.node_ids[:2].tolist() == [1, 2] and second.node_ids[-1] == 4
    assert first.node_ids[-1] != second.node_ids[0]
    assert first.node_ids[-1] < 0 and second.node_ids[0] < 0
    assert len(first.lonlat) == 3 and len(second.lonlat) == 2


def test_the_ways_meeting_at_a_blocked_node_do_not_share_it():
    ends = {cut_way(make_way(1, 2, way_id=way_id), np.array([2]))[0].node_ids[-1] for way_id in (10, 11)}
    assert len(ends) == 2 and all(end < 0 for end in ends)


def test_a_blocked_end_node_is_cut_off_from_the_ways_that_meet_there():
    (piece,) = cut_way(make_way(1, 2, 3), np.array([1]))
    assert piece.node_ids[0] < 0 and piece.node_ids[1:].tolist() == [2, 3]


def test_node_tags_say_what_stops_riders_and_what_takes_the_fun_away():
    nodes = {
        1: {"barrier": "gate", "access": "no"},
        2: {"barrier": "gate", "motorcycle": "no"},
        3: {"barrier": "bollard"},
        4: {"barrier": "bollard", "motor_vehicle": "yes"},
        5: {"barrier": "lift_gate"},
        6: {"barrier": "gate", "access": "yes"},
        7: {"ford": "yes"},
        8: {"barrier": "cattle_grid"},
        9: {"highway": "crossing", "access": "permit"},
    }
    found = node_flags(nodes, on_perennial_waterway=frozenset({7, 8}))
    assert found.perennial_fords.tolist() == [7]
    assert found.blocked.tolist() == [1, 2, 3, 9]
    assert found.gates.tolist() == [5]
    assert found.fords.tolist() == [7]


def test_a_gate_on_the_way_takes_its_fun_away_but_keeps_it_routable():
    way = way_from_tags(1, {"highway": "tertiary", "ref": "CV-9"}, table(1, 2, 3))
    assert with_node_flags(way, flags(gates=[2])).no_fun
    assert not with_node_flags(way, flags(gates=[9])).no_fun


def test_a_numbered_road_keeps_its_fun_across_a_ford_and_says_where_the_ford_is():
    way = way_from_tags(1, {"highway": "tertiary", "ref": "CV-363"}, table(1, 2, 3))
    told = with_node_flags(way, flags(fords=[2]))
    assert not told.no_fun and told.ford_positions == (1,)


def test_a_ford_on_a_road_without_a_ref_or_below_tertiary_takes_the_fun_away():
    without_ref = way_from_tags(1, {"highway": "tertiary"}, table(1, 2, 3))
    unclassified = way_from_tags(1, {"highway": "unclassified", "ref": "CR-5001"}, table(1, 2, 3))
    for way in (without_ref, unclassified):
        told = with_node_flags(way, flags(fords=[2]))
        assert told.no_fun and told.ford_positions == (1,)


def test_a_ford_on_a_river_or_canal_that_does_not_dry_up_takes_the_fun_away():
    way = way_from_tags(1, {"highway": "secondary", "ref": "DP-3902"}, table(1, 2, 3))
    assert with_node_flags(way, flags(fords=[2], perennial_fords=[2])).no_fun


def test_the_class_a_name_gives_does_not_make_a_road_numbered_enough_for_a_ford():
    # An unclassified road named like a road becomes tertiary (local_road_class), but the tag is what was mapped.
    way = way_from_tags(1, {"highway": "unclassified", "ref": "VF-TE-20", "name": "Carretera forestal"}, table(1, 2, 3))
    assert with_node_flags(way, flags(fords=[2])).no_fun


def test_a_one_way_road_lists_its_nodes_in_the_direction_it_is_ridden():
    along = way_from_tags(1, {"highway": "secondary", "oneway": "yes"}, table(1, 2, 3))
    against = way_from_tags(1, {"highway": "secondary", "oneway": "-1"}, table(1, 2, 3))
    both = way_from_tags(1, {"highway": "secondary"}, table(1, 2, 3))
    assert along.oneway and along.node_ids.tolist() == [1, 2, 3]
    assert against.oneway and against.node_ids.tolist() == [3, 2, 1]
    assert against.lonlat[0].tolist() == [0.002, 0.0]
    assert not both.oneway


def test_ways_that_are_not_roads_give_nothing():
    assert way_from_tags(1, {"highway": "footway"}, table(1, 2)) is None


def test_a_gate_on_a_side_road_cuts_the_side_road_off_not_the_road_that_passes_by():
    #  1 -- 2 -- 3     2 is where a private side road (2 -- 4) starts, with its gate
    through, side = make_way(1, 2, 3, way_id=10), make_way(2, 4, way_id=11)
    pieces = cut_ways([through, side], np.array([2]))
    assert pieces[0] == through
    assert pieces[1].node_ids[0] < 0 and pieces[1].node_ids[1] == 4


def test_a_gate_across_a_road_nothing_else_meets_cuts_it_in_two():
    assert len(cut_ways([make_way(1, 2, 3, way_id=10)], np.array([2]))) == 2


def way_at(way_id, tags, lon=0.0):
    table = np.array([[1, lon, 0.0], [2, lon + 0.001, 0.0]])
    return way_from_tags(way_id, {"highway": "unclassified", **tags}, table)


def classes(ways):
    return [way.road_class for way in demote_beside_tracks(ways)]


def test_a_promotion_without_a_surface_tag_is_taken_back_when_a_way_of_the_road_is_a_track():
    road = {"name": "Carretera de los Gazquez"}
    promoted, track = way_at(1, road), way_at(2, {**road, "surface": "dirt"}, lon=0.05)
    assert promoted.road_class == RoadClass.TERTIARY and track.road_class == RoadClass.TRACK
    assert classes([promoted, track]) == [RoadClass.UNCLASSIFIED, RoadClass.TRACK]


def test_a_ref_matches_the_track_wherever_it_is_but_a_name_only_close_by():
    named = {"name": "Carretera Vieja"}
    assert classes([way_at(1, named), way_at(2, {**named, "surface": "dirt"}, lon=2.0)])[0] == RoadClass.TERTIARY
    numbered = {"ref": "CR-5001", "name": "Carretera de Ciudad Real"}
    far_track = way_at(2, {"ref": "CR-5001", "highway": "track"}, lon=2.0)
    assert classes([way_at(1, numbered), far_track])[0] == RoadClass.UNCLASSIFIED


def test_an_untagged_lane_of_a_road_that_is_a_track_elsewhere_is_a_track():
    lane = {"name": "Vereda del Camí de les Farreres"}
    untagged, track = way_at(1, {"name": "Camí de les Farreres"}), way_at(2, {"name": "Camí de les Farreres", "highway": "track"}, lon=0.05)
    assert classes([untagged, track]) == [RoadClass.TRACK, RoadClass.TRACK]
    paved = way_at(1, {"name": "Camí de les Farreres", "surface": "asphalt"})
    assert classes([paved, track])[0] == RoadClass.UNCLASSIFIED
    assert classes([way_at(1, {"name": "Camí de les Farreres"}), way_at(2, {"name": "Camí de les Farreres", "highway": "track"}, lon=2.0)])[0] == RoadClass.UNCLASSIFIED
    assert way_at(3, lane).road_class == RoadClass.TRACK


def test_a_way_knows_whether_it_closes_part_of_the_year_or_is_for_destination_only():
    formentor = way_at(1, {"motor_vehicle:conditional": "no @ (Jun-Oct: Mo-Su 10:00-22:00)"})
    setenil = way_at(2, {"access": "destination"})
    assert formentor.closed_part_of_year and not formentor.destination_only
    assert setenil.destination_only and not setenil.closed_part_of_year


def test_a_promotion_the_surface_tag_vouches_for_stays_beside_a_track():
    road = {"name": "Carretera de los Gazquez"}
    vouched, track = way_at(1, {**road, "surface": "asphalt"}), way_at(2, {**road, "surface": "dirt"}, lon=0.05)
    assert classes([vouched, track])[0] == RoadClass.TERTIARY
