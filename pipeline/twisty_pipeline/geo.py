"""Planar geometry helpers for short polylines (local equirectangular projection)."""

import numpy as np

EARTH_RADIUS_M = 6_371_000.0


def project_to_meters(lonlat: np.ndarray) -> np.ndarray:
    """Project (lon, lat) degrees to local planar metres around the polyline's mean latitude."""
    lat0 = np.radians(lonlat[:, 1].mean())
    x = np.radians(lonlat[:, 0]) * EARTH_RADIUS_M * np.cos(lat0)
    y = np.radians(lonlat[:, 1]) * EARTH_RADIUS_M
    return np.column_stack([x, y])


def cumulative_distance(xy: np.ndarray) -> np.ndarray:
    """Distance from the first vertex to every vertex, in the units of `xy`."""
    steps = np.hypot(*np.diff(xy, axis=0).T)
    return np.concatenate([[0.0], np.cumsum(steps)])


def simplify_indices(xy: np.ndarray, tolerance: float) -> np.ndarray:
    """Douglas-Peucker simplification; returns the indices of the kept vertices (endpoints always kept)."""
    n = len(xy)
    if n < 3:
        return np.arange(n)
    keep = np.zeros(n, dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        chord = xy[b] - xy[a]
        offsets = xy[a + 1 : b] - xy[a]
        chord_length = np.hypot(*chord)
        if chord_length == 0:
            distances = np.hypot(offsets[:, 0], offsets[:, 1])
        else:
            distances = np.abs(chord[0] * offsets[:, 1] - chord[1] * offsets[:, 0]) / chord_length
        farthest = int(np.argmax(distances))
        if distances[farthest] > tolerance:
            k = a + 1 + farthest
            keep[k] = True
            stack.append((a, k))
            stack.append((k, b))
    return np.flatnonzero(keep)


def deflection_degrees(xy: np.ndarray) -> np.ndarray:
    """Absolute heading change at each vertex in degrees (0 at both endpoints)."""
    result = np.zeros(len(xy))
    if len(xy) < 3:
        return result
    incoming = xy[1:-1] - xy[:-2]
    outgoing = xy[2:] - xy[1:-1]
    cross = incoming[:, 0] * outgoing[:, 1] - incoming[:, 1] * outgoing[:, 0]
    dot = (incoming * outgoing).sum(axis=1)
    result[1:-1] = np.degrees(np.abs(np.arctan2(cross, dot)))
    return result


HILBERT_BITS = 16


def hilbert_index(lonlat: np.ndarray) -> np.ndarray:
    """Position of each (lon, lat) along a Hilbert curve over the points' bounding box.

    Points close on the curve are close on the map, so numbering by this index puts neighbours in neighbouring memory.
    """
    side = 1 << HILBERT_BITS
    low, high = lonlat.min(axis=0), lonlat.max(axis=0)
    cells = np.minimum((lonlat - low) / np.maximum(high - low, 1e-12) * side, side - 1).astype(np.int64)
    x, y = cells[:, 0].copy(), cells[:, 1].copy()
    index = np.zeros(len(lonlat), dtype=np.int64)
    for bit in range(HILBERT_BITS - 1, -1, -1):
        step = 1 << bit
        rx = ((x & step) > 0).astype(np.int64)
        ry = ((y & step) > 0).astype(np.int64)
        index += step * step * ((3 * rx) ^ ry)
        flip = (ry == 0) & (rx == 1)
        x = np.where(flip, side - 1 - x, x)
        y = np.where(flip, side - 1 - y, y)
        swap = ry == 0
        x, y = np.where(swap, y, x), np.where(swap, x, y)
    return index
