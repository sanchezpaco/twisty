import numpy as np

from twisty_pipeline.geo import cumulative_distance, deflection_degrees, simplify_indices


def test_cumulative_distance_sums_segments():
    xy = np.array([[0, 0], [3, 4], [3, 10]], dtype=float)
    assert cumulative_distance(xy).tolist() == [0, 5, 11]


def test_simplify_drops_collinear_points_and_keeps_corners():
    xy = np.array([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], dtype=float)
    assert simplify_indices(xy, tolerance=0.1).tolist() == [0, 2, 4]


def test_simplify_removes_jitter_below_tolerance():
    xy = np.array([[0, 0], [10, 0.5], [20, -0.5], [30, 0]], dtype=float)
    assert simplify_indices(xy, tolerance=1.0).tolist() == [0, 3]


def test_deflection_is_absolute_heading_change():
    xy = np.array([[0, 0], [1, 0], [1, 1], [2, 1]], dtype=float)
    np.testing.assert_allclose(deflection_degrees(xy), [0, 90, 90, 0])
