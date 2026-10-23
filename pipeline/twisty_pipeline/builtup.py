"""Which ways lie in a built-up area, from the places around them."""

import math
from collections import defaultdict
from dataclasses import replace

import numpy as np

from .geo import EARTH_RADIUS_M, cumulative_distance, project_to_meters
from .places import Place
from .roads import Way

# A town's streets reach about this far from the node OSM puts at its centre; a road further out is in the country.
BUILT_UP_RADIUS_M = 600.0
BUILT_UP_PLACE_KINDS = {"city", "town", "village", "suburb"}
# Cells must be wider than the radius, so that the places within it are in the 3 x 3 cells around a point.
CELL_DEGREES = 0.015


class PlaceIndex:
    """Places in a grid, to ask whether any lies within a radius of a point."""

    def __init__(self, places: list[Place]):
        self.cells: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
        for place in places:
            if place.kind in BUILT_UP_PLACE_KINDS:
                self.cells[self._cell(place.lon, place.lat)].append((place.lon, place.lat))

    def near(self, lon: float, lat: float, radius_m: float) -> bool:
        cx, cy = self._cell(lon, lat)
        metres_per_degree_lon = math.radians(1) * EARTH_RADIUS_M * math.cos(math.radians(lat))
        metres_per_degree_lat = math.radians(1) * EARTH_RADIUS_M
        for x in range(cx - 1, cx + 2):
            for y in range(cy - 1, cy + 2):
                for place_lon, place_lat in self.cells.get((x, y), ()):
                    dx = (place_lon - lon) * metres_per_degree_lon
                    dy = (place_lat - lat) * metres_per_degree_lat
                    if math.hypot(dx, dy) <= radius_m:
                        return True
        return False

    @staticmethod
    def _cell(lon: float, lat: float) -> tuple[int, int]:
        return math.floor(lon / CELL_DEGREES), math.floor(lat / CELL_DEGREES)


def mark_built_up(ways: list[Way], places: list[Place], radius_m: float = BUILT_UP_RADIUS_M) -> list[Way]:
    """The ways, with those whose middle is within `radius_m` of a city, town, village or suburb marked as built up."""
    index = PlaceIndex(places)
    return [way if way.built_up or not _middle_is_near(way, index, radius_m) else replace(way, built_up=True) for way in ways]


def _middle_is_near(way: Way, index: PlaceIndex, radius_m: float) -> bool:
    distance = cumulative_distance(project_to_meters(way.lonlat))
    lon, lat = way.lonlat[int(np.searchsorted(distance, distance[-1] / 2))]
    return index.near(lon, lat, radius_m)
