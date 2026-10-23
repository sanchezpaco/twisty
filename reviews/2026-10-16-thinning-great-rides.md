# A stop thinning that keeps great roads on the frontier

Date: 2026-10-16. Follows `reviews/2026-10-16-quality-score.md` (family 2 alone lost four great roads in the slider's
thinning). Branch `thin-great` on main 402f7a6. Bench on the Mac, 127 trips, scratch data dirs only (main's data, and
the family-2 graph of the earlier review).

## Where the thinning drops a frontier point that rides a great road

`sliderStops` keeps a frontier point only if, against the last kept stop, it is 3 minutes later, has 3,000 more score,
1.15 times the score and more twisty km. On family-2 data (trace of every frontier point): CV-363 has twelve points at
+34 to +38 min, each dropped by the ratio (1.11-1.14 against the stop at +20 min), the next kept stop being at +97 min;
CV-345's rides sit 0.6-0.9 min after the kept +20 min stop (the 3-minute step); CA-9104's +57 min ride is dropped by a
gain of 2,752 against 3,000. Vidrà has no frontier point at all (dominated). On today's data, 41 great (rating 4-5)
candidates whose own ride is on the frontier are ridden by no final stop, in 30 of the 127 trips (63 are ridden).

## The rule

In `withCoverageStops`, the first frontier point that rides at least 80 % of a rated 4-5 candidate that no stop rides
(at most `GREAT_RIDE_ROADS` = 3 candidates, by fun-km) is swapped in as that road's stop under `GREAT_RIDE_RULES`: 3
minutes after the stop before it, strictly more score, 2 km more twisty km (what the slider shows, in whole km), no gain
or ratio floor. It may take the place of the stop it follows within the 3 minutes, the second stop included, when it is
at least as good (`coverage.swap`). **The stops after it must step up from it by the slider's own rules** (3,000, 1.15,
3 minutes): one that does not is replaced by the great ride, and when two would be, the swap is not made. The slider's 9
stops, 2 swaps and the first and last stop stay as they were. The roads off the frontier still go through `combined`
with the slider's rules.

The first version admitted the stops after the ride under the ride's own relaxed rules, and app's shots of
great-cv-70-confrides showed the slider spending stops on differences nobody sees: a new +11 stop with 46 km of curves
next to the existing +15 with 46 km, and a new +25 with 50 km next to +29 with 54 km. The two corrections (the next stop
is checked by the slider's rules, the ride adds 2 km) bring the near-equal neighbours (adjacent stops less than 2 km of
twisty apart) back to today's count: 10 in the baseline, 19 with the first version, 10 now.

## Result (bench vs the same code with the rule off)

| | Today's data | Family-2 data |
| --- | --- | --- |
| Demanded pairs found | 69 -> 70 (BV-5114 Santa Fe), none lost | 65 -> 67 (CA-9104, CV-363), none lost |
| Against today's data | | CV-345 and Vidrà still lost |
| Trips with other routes | 12 of 127 | 18 |
| Stops per trip, mean (trips at 9) | 7.58 (66) -> 7.61 (67) | 7.72 (68) -> 7.77 (69) |
| Near-equal neighbours (< 2 km apart) | 10 -> 10 | 14 -> 14 |
| Largest gap between stops, mean / worst / trips over 45 min | 48.2 / 149 / 60 -> 48.3 / 149 / 60 | 48.6 / 140 / 60 -> 48.4 / 140 / 60 |
| Default stop moves by more than a minute | 4 trips | 6 |
| Lane km, all stops / default | 1,179 / 77 -> 1,132 / 77 | 1,221 / 63 -> 1,283 / 55 |
| Settled nodes | 1,351k, unchanged | unchanged |
| Ripoll -> Olot: km on C-153 | 0.9, unchanged | unchanged |

Earlier variants: the first version found A-4132 Alpujarra too (a stop at +42 and one at +77) and spent two near-equal
stops on it; with the next stop checked by the slider's rules the +42 stop no longer fits beside +59 and +64 and the
Alpujarra is not found any more. A (relaxed rules also for `combined`) changed 6 trips and found nothing.
great-cv-70-confrides: [0, 15, 29, 47] min before, [0, 15, 25, 47] now (the +25 stop, 50 km, takes the place of +29).
cross-007: the +45 stop becomes +47 (49 km) and rides C-153.

## What it does not fix

- CV-345 Alpuente - Titaguas is not a candidate (43 % curvy, `own-road-misses`): the rule works on candidates.
- Vidrà on regional-024 under family 2: no frontier point rides it (the routes that ride it go from 31 to 1), so a stop
  for it would not step up in score; that is the classics' extra fun beating it, not the thinning.
- The 77-minute hole of CV-363's slider becomes 63 (a stop at +34): spacing barely moves on average.
- Ripoll -> Olot: C-153's ride is dominated by Vidrà - Sant Privat and is not on the frontier.
