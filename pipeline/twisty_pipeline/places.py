"""Named places (cities, towns, villages…) for instant offline search in the app."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import osmium

from .geo import EARTH_RADIUS_M

# Most important first; `locality` is left out on purpose: in Spain it is mostly field and hill names.
PLACE_KINDS = ("city", "town", "village", "suburb", "hamlet")
PLACE_FILTER = "n/place=" + ",".join(PLACE_KINDS)
# Places are described by the nearest more important place ("Los Santos, near Ademuz") to tell namesakes apart.
MAX_CONTEXT_DISTANCE_M = 30_000.0
CHUNK_SIZE = 1_000


@dataclass(frozen=True)
class Place:
    name: str
    kind: str
    lon: float
    lat: float
    context: str | None = None


def read_places(nodes_pbf: Path) -> list[Place]:
    places = []
    for node in osmium.FileProcessor(str(nodes_pbf), osmium.osm.NODE):
        kind, name = node.tags.get("place"), node.tags.get("name")
        if kind in PLACE_KINDS and name and node.location.valid():
            places.append(Place(name, kind, node.location.lon, node.location.lat))
    return places


def with_context(places: list[Place]) -> list[Place]:
    rank = np.array([PLACE_KINDS.index(place.kind) for place in places])
    xyz = _unit_vectors(np.array([[place.lon, place.lat] for place in places]))
    context: list[str | None] = [None] * len(places)
    for level in range(1, len(PLACE_KINDS)):
        anchors = np.flatnonzero(rank < level)
        targets = np.flatnonzero(rank == level)
        if len(anchors) == 0:
            continue
        for chunk in np.array_split(targets, max(1, len(targets) // CHUNK_SIZE)):
            cosines = xyz[chunk] @ xyz[anchors].T
            nearest = np.argmax(cosines, axis=1)
            distances = EARTH_RADIUS_M * np.arccos(np.clip(cosines[np.arange(len(chunk)), nearest], -1, 1))
            for target, anchor, distance in zip(chunk, anchors[nearest], distances):
                if distance <= MAX_CONTEXT_DISTANCE_M:
                    context[target] = places[anchor].name
    return [Place(p.name, p.kind, p.lon, p.lat, c) for p, c in zip(places, context)]


def _unit_vectors(lonlat: np.ndarray) -> np.ndarray:
    lon, lat = np.radians(lonlat[:, 0]), np.radians(lonlat[:, 1])
    return np.column_stack([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
