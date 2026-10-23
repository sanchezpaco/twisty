import numpy as np
from conftest import straight_road, zigzag_road

from twisty_pipeline.curvature import cumulative_fun_m, curvy_intervals, turning_profile


def test_straight_road_has_no_curvy_intervals(to_lonlat):
    profile = turning_profile(to_lonlat(straight_road(10_000)))
    assert curvy_intervals(profile) == []


def test_jittery_straight_road_is_not_curvy(to_lonlat):
    xy = straight_road(10_000, step_m=20)
    xy[:, 1] = np.random.default_rng(1).normal(0, 1.5, len(xy))
    assert curvy_intervals(turning_profile(to_lonlat(xy))) == []


def test_zigzag_road_is_one_long_curvy_interval(to_lonlat):
    profile = turning_profile(to_lonlat(zigzag_road(8_000)))
    intervals = curvy_intervals(profile)
    assert len(intervals) == 1
    start, end = intervals[0]
    assert start < 600 and end > profile.distance_m[-1] - 600


def test_curvy_section_inside_straight_road_is_located(to_lonlat):
    approach = straight_road(5_000)
    twisty = zigzag_road(6_000) + approach[-1]
    exit_road = straight_road(5_000) + twisty[-1]
    profile = turning_profile(to_lonlat(np.concatenate([approach, twisty[1:], exit_road[1:]])))
    intervals = curvy_intervals(profile)
    assert len(intervals) == 1
    start, end = intervals[0]
    assert 4_000 < start < 5_600
    assert 10_400 < end < 12_000


def test_short_curvy_bit_is_ignored(to_lonlat):
    approach = straight_road(5_000)
    twisty = zigzag_road(1_500) + approach[-1]
    profile = turning_profile(to_lonlat(np.concatenate([approach, twisty[1:]])))
    assert curvy_intervals(profile) == []


def test_fast_sweepers_count_as_curvy(to_lonlat):
    profile = turning_profile(to_lonlat(zigzag_road(10_000, radius_m=300, step_m=20)))
    assert len(curvy_intervals(profile)) == 1


def test_fun_is_zero_on_straights_and_nearly_full_on_tight_roads(to_lonlat):
    straight = turning_profile(to_lonlat(straight_road(5_000)))
    tight = turning_profile(to_lonlat(zigzag_road(5_000, radius_m=40)))
    assert cumulative_fun_m(straight)[-1] == 0
    assert cumulative_fun_m(tight)[-1] / tight.distance_m[-1] > 0.9


def test_sweepers_give_partial_fun(to_lonlat):
    sweeping = turning_profile(to_lonlat(zigzag_road(5_000, radius_m=300, step_m=20)))
    share = cumulative_fun_m(sweeping)[-1] / sweeping.distance_m[-1]
    assert 0.5 < share < 0.8
