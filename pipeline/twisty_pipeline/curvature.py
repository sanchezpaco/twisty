"""Twistiness: how much a road turns per kilometre, how much fun that is, and where the long curvy runs are."""

from dataclasses import dataclass

import numpy as np

from .geo import cumulative_distance, deflection_degrees, project_to_meters, simplify_indices

# Removes mapping jitter (zig-zags on straight roads) without flattening real bends.
DENOISE_TOLERANCE_M = 5.0
# A single vertex turning more than this is almost always a mapping glitch.
MAX_DEFLECTION_DEG = 150.0

SAMPLE_STEP_M = 100.0
WINDOW_M = 1000.0
# Low enough to keep flowing roads made of fast sweepers, not just tight mountain passes.
CURVY_THRESHOLD_DEG_PER_KM = 120.0
MAX_STRAIGHT_GAP_M = 800.0
MIN_RUN_LENGTH_M = 4000.0

# Fun fraction (0..1) as a piecewise-linear function of local twistiness: straights give nothing,
# fast sweepers already give a good share, tight mountain roads give everything.
FUN_CURVE_DEG_PER_KM = (40.0, 150.0, 500.0)
FUN_CURVE_VALUE = (0.0, 0.55, 1.0)


@dataclass(frozen=True)
class TurningProfile:
    distance_m: np.ndarray  # cumulative distance at every original vertex
    deflection_deg: np.ndarray  # heading change at every original vertex (0 where removed as noise)


def turning_profile(lonlat: np.ndarray) -> TurningProfile:
    xy = project_to_meters(lonlat)
    distance = cumulative_distance(xy)
    kept = simplify_indices(xy, DENOISE_TOLERANCE_M)
    deflection = np.zeros(len(xy))
    deflection[kept] = np.minimum(deflection_degrees(xy[kept]), MAX_DEFLECTION_DEG)
    return TurningProfile(distance, deflection)


def twist_density(total_turning_deg: float, length_m: float) -> float:
    """Degrees of heading change per kilometre."""
    return total_turning_deg / (length_m / 1000.0) if length_m > 0 else 0.0


def fun_fraction(density_deg_per_km: np.ndarray) -> np.ndarray:
    return np.interp(density_deg_per_km, FUN_CURVE_DEG_PER_KM, FUN_CURVE_VALUE)


def vertex_density(profile: TurningProfile) -> np.ndarray:
    """Heading change per km over the window around every vertex, over the part of the window the way covers: a
    roundabout or a ramp shorter than the window is as tight as it is, not diluted by a straight it does not have."""
    return _window_density(profile, profile.distance_m, min_window_m=0.0)


def vertex_fun(profile: TurningProfile) -> np.ndarray:
    """Fun fraction at every vertex, from the heading change over the window around it."""
    return fun_fraction(_window_density(profile, profile.distance_m))


def cumulative_fun_m(profile: TurningProfile, fun: np.ndarray | None = None) -> np.ndarray:
    """Fun-weighted distance from the first vertex: a metre of perfect twisty road counts as one metre. `fun` is the
    fun fraction at each vertex when it comes from elsewhere (the road's chain), else the profile's own."""
    fun = vertex_fun(profile) if fun is None else fun
    steps = np.diff(profile.distance_m) * (fun[:-1] + fun[1:]) / 2
    return np.concatenate([[0.0], np.cumsum(steps)])


def curvy_intervals(profile: TurningProfile) -> list[tuple[float, float]]:
    """Distance intervals (start_m, end_m) where the road stays twisty for long enough to be worth riding."""
    total = profile.distance_m[-1]
    if total < MIN_RUN_LENGTH_M:
        return []
    centres = np.arange(SAMPLE_STEP_M / 2, total, SAMPLE_STEP_M)
    curvy = _window_density(profile, centres) >= CURVY_THRESHOLD_DEG_PER_KM
    runs = _true_runs(curvy)
    intervals = [(centres[a] - SAMPLE_STEP_M / 2, centres[b] + SAMPLE_STEP_M / 2) for a, b in runs]
    merged = _merge_close(intervals, MAX_STRAIGHT_GAP_M)
    return [(start, min(end, total)) for start, end in merged if end - start >= MIN_RUN_LENGTH_M]


def _window_density(profile: TurningProfile, centres: np.ndarray, min_window_m: float = WINDOW_M / 2) -> np.ndarray:
    total = profile.distance_m[-1]
    if total == 0:
        return np.zeros(len(centres))
    low = np.clip(centres - WINDOW_M / 2, 0, total)
    high = np.clip(centres + WINDOW_M / 2, 0, total)
    turning_before = np.concatenate([[0.0], np.cumsum(profile.deflection_deg)])
    first = np.searchsorted(profile.distance_m, low, side="left")
    past_last = np.searchsorted(profile.distance_m, high, side="right")
    turning = turning_before[past_last] - turning_before[first]
    # Short ways see a clipped window; for the fun, treating the unseen part as straight avoids inflating single kinks.
    return turning / (np.maximum(high - low, min_window_m) / 1000.0)


def _true_runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """Inclusive (first, last) index pairs of consecutive True values."""
    padded = np.concatenate([[False], mask, [False]]).astype(np.int8)
    edges = np.diff(padded)
    starts = np.flatnonzero(edges == 1)
    ends = np.flatnonzero(edges == -1) - 1
    return list(zip(starts.tolist(), ends.tolist()))


def _merge_close(intervals: list[tuple[float, float]], max_gap: float) -> list[tuple[float, float]]:
    merged: list[tuple[float, float]] = []
    for start, end in intervals:
        if merged and start - merged[-1][1] <= max_gap:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))
    return merged
