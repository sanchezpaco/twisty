import numpy as np

from twisty_pipeline.builtup import BUILT_UP_RADIUS_M, PlaceIndex, mark_built_up
from twisty_pipeline.places import Place
from twisty_pipeline.roads import RoadClass, Way

LAT = 42.0
# One degree of longitude at this latitude, in metres, to put things at a known distance.
METRES_PER_DEGREE_LON = 111_195.0 * np.cos(np.radians(LAT))


def place(kind="village", east_m=0.0):
    return Place("Somewhere", kind, 2.0 + east_m / METRES_PER_DEGREE_LON, LAT)


def way(*east_m, built_up=False):
    lonlat = np.array([[2.0 + metres / METRES_PER_DEGREE_LON, LAT] for metres in east_m])
    return Way(1, RoadClass.TERTIARY, None, None, 30.0, False, np.arange(len(lonlat), dtype=np.int64), lonlat, built_up)


def test_a_place_is_near_a_point_within_the_radius_only():
    index = PlaceIndex([place()])
    assert index.near(2.0 + 500 / METRES_PER_DEGREE_LON, LAT, BUILT_UP_RADIUS_M)
    assert not index.near(2.0 + 700 / METRES_PER_DEGREE_LON, LAT, BUILT_UP_RADIUS_M)


def test_a_place_in_the_next_grid_cell_still_counts():
    east = 0.014 * METRES_PER_DEGREE_LON  # just before the cell edge at 0.015 degrees
    index = PlaceIndex([place(east_m=east)])
    assert index.near(2.0 + (east + 400) / METRES_PER_DEGREE_LON, LAT, BUILT_UP_RADIUS_M)


def test_only_cities_towns_villages_and_suburbs_make_a_road_built_up():
    assert not PlaceIndex([place("hamlet")]).near(2.0, LAT, BUILT_UP_RADIUS_M)
    for kind in ("city", "town", "village", "suburb"):
        assert PlaceIndex([place(kind)]).near(2.0, LAT, BUILT_UP_RADIUS_M), kind


def test_a_way_is_built_up_when_its_middle_is_near_a_place():
    through_town = way(-3_000, 0, 3_000)
    in_the_mountains = way(2_000, 4_000, 6_000)
    marked = mark_built_up([through_town, in_the_mountains], [place()])
    assert [w.built_up for w in marked] == [True, False]


def test_a_way_that_only_starts_in_a_town_is_judged_by_its_middle():
    leaving_town = way(0, 5_000, 10_000)
    assert not mark_built_up([leaving_town], [place()])[0].built_up


def test_a_way_built_up_by_its_tags_stays_built_up():
    assert mark_built_up([way(5_000, 6_000, built_up=True)], [place()])[0].built_up
