import numpy as np

from twisty_pipeline.roads import (
    RoadClass,
    Way,
    fun_weight,
    is_accessible,
    is_built_up_by_tags,
    is_closed_part_of_the_year,
    is_destination_only,
    is_fun_blocked,
    is_narrow,
    is_passable,
    is_paved,
    local_road_class,
    travel_direction,
)


def make_way(road_class=RoadClass.TERTIARY, maxspeed_kmh=None, built_up=False, no_fun=False):
    return Way(1, road_class, None, None, maxspeed_kmh, False, np.array([1, 2]), np.zeros((2, 2)), built_up, no_fun)


def test_open_roads_keep_all_their_fun():
    assert fun_weight(make_way(RoadClass.TERTIARY)) == 1.0
    assert fun_weight(make_way(RoadClass.SECONDARY, maxspeed_kmh=90)) == 1.0


def test_slow_lanes_keep_only_part_of_their_fun():
    assert 0.0 < fun_weight(make_way(RoadClass.UNCLASSIFIED)) < 0.5


def test_motorways_and_urban_stretches_give_no_fun():
    assert fun_weight(make_way(RoadClass.MOTORWAY)) == 0.0
    assert fun_weight(make_way(maxspeed_kmh=50, built_up=True)) == 0.0


def test_a_low_limit_outside_a_town_warns_about_the_bends_and_keeps_the_fun():
    assert fun_weight(make_way(maxspeed_kmh=30)) == 1.0
    assert fun_weight(make_way(maxspeed_kmh=50)) == 1.0


def test_a_built_up_road_without_a_low_limit_keeps_its_fun():
    assert fun_weight(make_way(maxspeed_kmh=70, built_up=True)) == 1.0


def test_tags_tell_a_built_up_road():
    assert is_built_up_by_tags({"maxspeed": "ES:urban"})
    assert is_built_up_by_tags({"maxspeed": "30", "source:maxspeed": "ES:urban"})
    assert is_built_up_by_tags({"maxspeed": "30", "zone:maxspeed": "ES:urban"})
    assert is_built_up_by_tags({"lit": "yes"})
    assert is_built_up_by_tags({"sidewalk": "both"})
    assert is_built_up_by_tags({"sidewalk:left": "separate"})


def test_tags_that_say_there_is_nothing_urban_do_not_make_a_road_built_up():
    assert not is_built_up_by_tags({"maxspeed": "30", "surface": "asphalt"})
    assert not is_built_up_by_tags({"sidewalk": "no", "lit": "no"})
    assert not is_built_up_by_tags({"sidewalk:both": "none"})


def test_roads_are_paved_unless_tags_or_name_say_otherwise():
    assert is_paved({"highway": "tertiary", "name": "Carretera de Tost"})
    assert is_paved({"highway": "unclassified", "tracktype": "grade1", "smoothness": "bad"})


def test_gravel_tracks_are_not_paved():
    assert not is_paved({"surface": "gravel"})
    assert not is_paved({"tracktype": "grade2"})
    assert not is_paved({"smoothness": "very_bad"})
    assert not is_paved({"highway": "unclassified", "surface": "dirt"})
    assert not is_paved({"name": "Pista de la Umbría"})
    assert not is_paved({"name": "Camino forestal del Collado"})
    assert not is_paved({"name": "Otsaportilloko basobidea"})


def test_a_surface_tag_must_name_a_rideable_surface_every_part_of_it():
    for surface in ("tierra", "Tierra", "ripio", "sin_pavimentar", "rock", "wood", "dirt/sand", "dirt; asphalt", "asphalt;gravel"):
        assert not is_paved({"highway": "tertiary", "surface": surface}), surface
    for surface in ("asphalt", "Asphalt", "asphalt;concrete", "sett", "cobblestone", "unhewn_cobblestone"):
        assert is_paved({"highway": "tertiary", "surface": surface}), surface


def test_cobbles_carry_a_rider_through_but_are_not_sought_out():
    assert is_fun_blocked({"surface": "cobblestone"})
    assert is_fun_blocked({"surface": "asphalt;unhewn_cobblestone"})
    assert not is_fun_blocked({"surface": "sett"})


def test_a_drove_road_without_a_paved_surface_or_a_number_is_a_track():
    for name in ("Cañada Real Soriana", "Vereda del Camino de Úbeda a Granada", "Cordel de las Merinas", "Colada de Alcalá"):
        assert not is_paved({"highway": "unclassified", "name": name}), name
    assert is_paved({"highway": "unclassified", "name": "Cañada Real Soriana", "surface": "asphalt"})
    assert is_paved({"highway": "tertiary", "name": "Cordel de las Merinas", "ref": "SO-P-5001"})
    assert is_paved({"highway": "tertiary", "name": "Calle Cañada"})


def test_tracks_are_fun_for_riders_who_opt_in_but_less_than_tarmac():
    assert 0.0 < fun_weight(make_way(RoadClass.TRACK)) < fun_weight(make_way(RoadClass.TERTIARY))


def test_highway_tracks_are_never_paved():
    assert not is_paved({"highway": "track", "surface": "asphalt"})


def test_impassable_ways_are_left_out_even_as_tracks():
    assert is_passable({"smoothness": "horrible"})
    assert not is_passable({"smoothness": "impassable"})


def test_a_way_the_tags_block_gives_no_fun():
    assert fun_weight(make_way(no_fun=True)) == 0.0
    assert fun_weight(make_way(RoadClass.TRACK, no_fun=True)) == 0.0


def test_one_way_roads_are_not_sought_out_for_their_curves():
    for value in ("yes", "1", "-1", "reversible", "alternating"):
        assert is_fun_blocked({"highway": "tertiary", "oneway": value}), value
    assert not is_fun_blocked({"highway": "tertiary", "oneway": "no"})
    assert not is_fun_blocked({"highway": "tertiary"})


def test_one_way_tags_and_the_implied_ones_set_the_direction_a_road_is_ridden_in():
    assert travel_direction({"highway": "tertiary", "oneway": "yes"}) == 1
    assert travel_direction({"highway": "tertiary", "oneway": "-1"}) == -1
    assert travel_direction({"highway": "tertiary"}) == 0
    assert travel_direction({"highway": "motorway"}) == 1
    assert travel_direction({"highway": "motorway_link"}) == 1
    assert travel_direction({"highway": "tertiary", "junction": "roundabout"}) == 1
    assert travel_direction({"highway": "motorway_link", "oneway": "no"}) == 0
    # A lane whose direction changes with the hour stays two-way.
    assert travel_direction({"highway": "tertiary", "oneway": "reversible"}) == 0


def test_roads_closed_part_of_the_year_are_not_sought_out():
    assert is_fun_blocked({"motor_vehicle:conditional": "no @ (Jun 11-Sep 30)"})
    assert is_fun_blocked({"access:conditional": "private @ (Dec 01-May 01)"})
    assert is_fun_blocked({"vehicle:conditional": "no @ Dec 1-Mar 1"})
    assert not is_fun_blocked({"motor_vehicle:conditional": "yes @ (Oct-Mar)"})
    assert not is_fun_blocked({"maxspeed:conditional": "30 @ (wet)"})


def test_destination_only_roads_are_not_sought_out():
    for key in ("access", "vehicle", "motor_vehicle", "motorcycle"):
        for value in ("destination", "residents", "customers", "delivery"):
            assert is_fun_blocked({key: value}), (key, value)
    assert not is_fun_blocked({"motor_vehicle": "designated"})
    assert not is_fun_blocked({"access": "yes", "motorcycle": "permissive"})
    assert is_destination_only({"motor_vehicle": "destination"}) and not is_destination_only({"access": "yes"})


def test_a_conditional_closure_closes_the_road_part_of_the_year():
    assert is_closed_part_of_the_year({"motor_vehicle:conditional": "no @ (Jun-Oct: Mo-Su 10:00-22:00)"})
    assert is_closed_part_of_the_year({"access:conditional": "private @ (Dec-May)"})
    assert not is_closed_part_of_the_year({"maxspeed:conditional": "30 @ (wet)"})
    assert not is_closed_part_of_the_year({"motor_vehicle:conditional": "yes @ (Jun-Oct)"})


def test_a_lane_designated_to_a_class_of_vehicle_is_not_for_riders():
    assert not is_accessible({"highway": "trunk", "access": "designated"})
    assert is_accessible({"highway": "primary", "motor_vehicle": "designated"})
    assert is_accessible({"highway": "track", "motorcycle": "designated"})


def test_rough_and_loose_roads_are_not_sought_out_for_their_curves():
    assert is_fun_blocked({"smoothness": "bad"})
    assert is_fun_blocked({"hazard": "loose_gravel"})
    assert not is_fun_blocked({"smoothness": "intermediate"})
    assert is_paved({"highway": "tertiary", "smoothness": "bad"})


def test_driveways_and_parking_aisles_are_not_sought_out():
    for service in ("driveway", "parking_aisle", "alley", "drive-through"):
        assert is_fun_blocked({"highway": "unclassified", "service": service}), service
    assert not is_fun_blocked({"highway": "tertiary"})


def test_a_way_with_a_ford_is_a_track():
    assert not is_paved({"highway": "unclassified", "ford": "yes"})
    assert is_paved({"highway": "unclassified", "ford": "no"})


def test_a_street_name_says_the_road_is_in_a_town():
    for name in ("Calle de Arturo Soria", "Passeig de la Vall d'Hebron", "Avinguda Diagonal", "Rúa Pena", "Ronda de Segovia",
                 "Polígono Industrial de Otero", "Arluzepe kalea", "Gran etorbidea", "Urbanització Can Palet"):
        assert is_built_up_by_tags({"name": name}), name
    for name in ("Carretera de Tost", "Camino de la Calle", "Camí de la Plaça", "Estrada A Fonsagrada", "Calleja"):
        assert not is_built_up_by_tags({"name": name}), name


def test_narrow_roads_are_single_lane_two_way_roads_or_those_3_5_m_wide_at_most():
    assert is_narrow({"lanes": "1"})
    assert is_narrow({"narrow": "yes"})
    assert is_narrow({"width": "3.5"})
    assert is_narrow({"width": "3,2 m"})
    assert not is_narrow({"width": "4"})
    assert not is_narrow({"lanes": "2"})
    assert not is_narrow({"width": "wide"})


def test_a_one_way_single_lane_carriageway_is_not_narrow():
    assert not is_narrow({"lanes": "1", "oneway": "yes"})
    assert not is_narrow({"lanes": "1", "oneway": "-1"})
    assert is_narrow({"lanes": "1", "oneway": "no"})


def test_unclassified_roads_with_a_ref_and_a_paved_surface_are_tertiary():
    assert local_road_class(RoadClass.UNCLASSIFIED, {"ref": "JV-7032", "surface": "asphalt"}) == RoadClass.TERTIARY
    assert local_road_class(RoadClass.UNCLASSIFIED, {"ref": "JV-7032", "tracktype": "grade1"}) == RoadClass.TERTIARY


def test_a_ref_alone_proves_nothing():
    assert local_road_class(RoadClass.UNCLASSIFIED, {"ref": "CR-5001"}) == RoadClass.UNCLASSIFIED
    assert local_road_class(RoadClass.UNCLASSIFIED, {"ref": "SL-13", "surface": "compacted"}) == RoadClass.UNCLASSIFIED


def test_unclassified_roads_named_like_a_road_are_tertiary():
    for name in ("Carretera de Tost", "Ctra. de la Mare de Déu del Mont", "Estrada de Vilar", "Carreterín de Fuentes", "Etxalar - Zugarramurdi errepidea"):
        assert local_road_class(RoadClass.UNCLASSIFIED, {"name": name}) == RoadClass.TERTIARY, name


def test_lanes_and_unnamed_unclassified_roads_stay_unclassified():
    for name in (None, "Camino de la Solana", "Camí de sa Pedrera", "Calle Mayor", "Antigua Carretera de Ponferrada"):
        assert local_road_class(RoadClass.UNCLASSIFIED, {"name": name} if name else {}) == RoadClass.UNCLASSIFIED, name


def test_a_narrow_road_is_promoted_only_when_its_surface_is_mapped_paved():
    assert local_road_class(RoadClass.UNCLASSIFIED, {"name": "Carretera del Coll", "lanes": "1"}) == RoadClass.UNCLASSIFIED
    narrow_paved = {"name": "Carretera del Coll", "lanes": "1", "surface": "asphalt"}
    assert local_road_class(RoadClass.UNCLASSIFIED, narrow_paved) == RoadClass.TERTIARY


def test_a_road_open_to_riders_by_permission_is_not_promoted():
    tags = {"name": "Carretera del Canal", "surface": "asphalt"}
    for key in ("access", "motor_vehicle", "vehicle", "motorcycle"):
        assert local_road_class(RoadClass.UNCLASSIFIED, {**tags, key: "permissive"}) == RoadClass.UNCLASSIFIED, key


def test_only_unclassified_roads_change_class():
    assert local_road_class(RoadClass.SECONDARY, {"ref": "N-6", "name": "Carretera de Madrid"}) == RoadClass.SECONDARY
    assert local_road_class(RoadClass.TRACK, {"ref": "X-1", "surface": "asphalt"}) == RoadClass.TRACK
