"""Twisties: long curvy stretches of road, shown on the map as a Spain-wide overview."""

from dataclasses import dataclass

import numpy as np

from .chains import Chain, road_profile
from .curvature import cumulative_fun_m, curvy_intervals, turning_profile, twist_density
from .roads import RoadClass, pace_factor

MIN_TWISTY_LENGTH_M = 3000.0
MIN_TWISTY_FUN = 0.35
# Fun fraction needed for ratings 2..5; anything above the minimum is at least 1.
# Keep in sync with FUN_RATING_THRESHOLDS in app/src/lib/routing/ride.ts.
RATING_FUN_THRESHOLDS = (0.45, 0.65, 0.8, 0.92)


@dataclass(frozen=True)
class Twisty:
    name: str | None
    ref: str | None
    road_class: RoadClass
    length_m: float
    twist_deg_per_km: float
    fun: float
    rating: int
    lonlat: np.ndarray


def find_twisties(chains: list[Chain]) -> list[Twisty]:
    return [twisty for chain in chains for twisty in _chain_twisties(chain)]


def rating_for(fun: float) -> int:
    return 1 + sum(int(fun >= threshold) for threshold in RATING_FUN_THRESHOLDS)


def _chain_twisties(chain: Chain) -> list[Twisty]:
    profile = road_profile(chain)
    intervals = curvy_intervals(profile)
    if not intervals:
        return []
    fun_m = cumulative_fun_m(profile) * pace_factor(chain.road_class)
    # The twist shown is the road's own geometry, town corners included.
    deflection_deg = turning_profile(chain.lonlat).deflection_deg
    twisties = []
    for start_m, end_m in intervals:
        start = int(np.searchsorted(profile.distance_m, start_m, side="right")) - 1
        end = int(np.searchsorted(profile.distance_m, end_m, side="left"))
        end = min(end, len(profile.distance_m) - 1)
        length = profile.distance_m[end] - profile.distance_m[start]
        if length < MIN_TWISTY_LENGTH_M:
            continue
        fun = (fun_m[end] - fun_m[start]) / length
        if fun < MIN_TWISTY_FUN:
            continue
        twisties.append(
            Twisty(
                name=chain.name,
                ref=chain.ref,
                road_class=chain.road_class,
                length_m=float(length),
                twist_deg_per_km=twist_density(deflection_deg[start + 1 : end].sum(), length),
                fun=float(fun),
                rating=rating_for(fun),
                lonlat=chain.lonlat[start : end + 1],
            )
        )
    return twisties
