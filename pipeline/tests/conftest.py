import numpy as np
import pytest

METERS_PER_DEGREE = 111_195.0


def lonlat_from_meters(xy: np.ndarray, lat0: float = 40.0) -> np.ndarray:
    """Inverse of the local projection, good enough for synthetic test roads."""
    lat = lat0 + xy[:, 1] / METERS_PER_DEGREE
    lon = xy[:, 0] / (METERS_PER_DEGREE * np.cos(np.radians(lat0)))
    return np.column_stack([lon, lat])


def straight_road(length_m: float, step_m: float = 25.0) -> np.ndarray:
    x = np.arange(0.0, length_m + step_m, step_m)
    return np.column_stack([x, np.zeros_like(x)])


def zigzag_road(length_m: float, radius_m: float = 60.0, step_m: float = 10.0) -> np.ndarray:
    """Alternating left/right arcs, like a mountain road."""
    points, heading, position = [np.zeros(2)], 0.0, np.zeros(2)
    turn_per_step = step_m / radius_m
    arc_steps = int(np.pi / 2 / turn_per_step)
    for i in range(int(length_m / step_m)):
        direction = 1 if (i // arc_steps) % 2 == 0 else -1
        heading += direction * turn_per_step
        position = position + step_m * np.array([np.cos(heading), np.sin(heading)])
        points.append(position)
    return np.array(points)


@pytest.fixture
def to_lonlat():
    return lonlat_from_meters
