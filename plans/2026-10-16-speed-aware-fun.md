# Plan: speed-aware curve fun (lateral load)

Status: for the director's approval, nothing fitted, no code. Owner: `routing` as `gis-data-engineer`. Date: 2026-10-16.
Source: maintainer, 2026-10-16 (ROADMAP Phase 4, "Speed-aware curve fun"): score a bend by how it rides at the road's
speed, so fast sweepers stop scoring as almost straight. Follows `reviews/2026-10-16-two-sided-survey.md` (step 3: on
roads the model never saw, curve fun ranks narrow lanes above wide classics, Spearman -0.82 scout / -0.72 expert) and
`plans/2026-10-15-fun-calibration-step2.md` (no change of the density curve beats the baseline).

## The idea, and why it is a different kind of change

Today a window's fun depends on the road's shape only: heading change per km mapped by a fixed curve (40 deg/km -> 0,
150 -> 0.55, 500 -> 1), times `pace_factor(class)` (0 at 40 km/h, 1 from 60 km/h). A trunk road at 100 deg/km and a
lane at 100 deg/km get the same curve value although the first is ridden at 90 km/h and the second at 40. The lateral
load a bend asks is `a = kappa * v^2` (kappa = heading change per metre, v the speed the road is ridden at): the same
bends ask more of the rider on a fast road, and the fun is the share of a comfortable load they ask.

Candidate (at most three named constants at the top of `curvature.py`, none in the planner):
`fun(window) = clamp((a - A0) / (A_MAX - A0), 0, 1) ** P`, with `a = kappa(window) * v(window)^2`, kappa from the window
density the model already computes (`WINDOW_M` 1 km), `v` the class cruising speed capped by the posted limit
(`BASE_SPEED_KMH`, `maxspeed`: the same inputs as `travel_speed_kmh`, before its curve cap). `A0` replaces the 40 deg/km
zero point (it now depends on the speed), `A_MAX` is the load at which a bend is fully fun (beyond it the rider slows
and the time model already charges for it), `P` <= 1 keeps the knee the present curve has. `pace_factor` leaves
`fun_weight` and `twisties.py` if the speed is inside the formula (it is the same idea for slow classes); it stays if
the probe below says the lanes are not lowered enough by speed alone.

Load for reference (m/s2, from the mean heading change at the class speed):

| deg/km | trunk 95 | primary 80 | secondary 70 | tertiary 60 | unclassified 45 |
| --- | --- | --- | --- | --- | --- |
| 40 | 0.49 | 0.34 | 0.26 | 0.19 | 0.11 |
| 120 | 1.46 | 1.03 | 0.79 | 0.58 | 0.33 |
| 150 | 1.82 | 1.29 | 0.99 | 0.73 | 0.41 |
| 250 | 3.04 | 2.15 | 1.65 | 1.21 | 0.68 |
| 500 | 6.08 | 4.31 | 3.30 | 2.42 | 1.36 |

## A feasibility probe, already run (no fitting: seven fixed constant sets, reported as a range)

Data: the spent held-out set (16 of 20 matched; development data from now on, so it cannot be the acceptance test) and
the calibration dev half (60 matched). Script `.claude/handoffs/routing-scripts/probe_lateral.py` (git-ignored).

| | Spearman, held-out scout / expert | pairs ordered (labels 1.5 apart) | calibration dev, all | dev fast-sweepers | dev mixed |
| --- | --- | --- | --- | --- | --- |
| today | -0.822 / -0.723 | 0 of 63 | 0.469 | 0.337 | 0.158 |
| lateral load, `A0` 0.3-0.5, `A_MAX` 2-6, `P` 0.7-1 | -0.54 to -0.58 / -0.53 to -0.59 | 9-10 of 63 | 0.36-0.37 | 0.24 | -0.04 to 0.01 |

What it says, as measurement: the load moves the held-out order a long way (from -0.82 to about -0.55) and is not enough
on its own (still negative: every held-out lane is dense enough to saturate the load at 60 km/h, so it stays above the
classics); it also costs the calibration dev half 0.10 overall, because the mixed class (the tertiary roads labelled
3-4.5) loses what it had. Two lessons for the plan: a pure load formula is not the answer, and the two yardsticks pull
apart (below). The probe says nothing yet about a speed that depends on the road's quality, which no tag in the
pipeline holds (step 1 of the two-sided survey).

## Two yardsticks that disagree, and which one decides

- **Calibration set** (164 stretches, 1.5-3 km): the label is the *character* of a stretch; its fast-class stretches
  are rated low (fast sweepers: mean label 2.85) and the labels come from scout and expert at about +-1.
- **Held-out sets** (`worth`, would a rider detour for it): classics 4-5, lanes 1-3, blind, two raters.
The maintainer's aim is worth, not character. So: **acceptance is on the fresh held-out set** (below); **the
calibration test half is a guard** (not worse than today beyond its bootstrap interval, urban and straight guards as in
step 2), not a target. If the two cannot both be met, the conflict goes to the maintainer with the numbers.

## Family to try, in this order (stop at the first that passes; "no change" is an allowed answer)

1. **Load at class speed** (the formula above), `A0`, `A_MAX`, `P` fitted on dev data = calibration dev half plus the
   spent held-out set (16 roads; mind that it is small and that fitting to it is overfitting by design: it is why the
   fresh set exists).
2. **Load plus the present curve**: fun = max(present curve, load term), so a tight lane keeps what it has and a fast
   road is lifted: it cannot cost the mixed class, and it cannot lower the lanes either (so it solves the classics side
   only; reported as such).
3. **Load with a speed that the road can hold**: the class speed lowered where the posted limit or the surveyed tags say
   so (`maxspeed`, `is_narrow`, surface), nothing else; it uses only tags the pipeline has.
Anything that needs a quality-of-road signal beyond those tags is out of scope and is reported as the next question
(the two-sided survey found no tag that separates council lanes from great tertiary roads).

## The fresh held-out set (road-scout builds it, blind to the model; the director routes it)

Never opened before the final test, read once. 24 roads at least, 8 each, in five or more regions, none in
`great-roads.json`, `calibration-set.json` or the spent set: **classics** (wide, fast, smooth: trunk, primary,
secondary), **council lanes** (narrow, slow, broken: tertiary or unclassified), and **great tertiary roads** (the Vidrà,
Tost, CV-363 kind: tertiary, worth the detour). The third group is what makes a class shortcut visible: a model that
lowers every tertiary lane fails it. Same format as `two-sided-holdout.json` (`worth` 1-5 from the scout, the expert's
blind `worth` in shuffled order with no labels), with both ends **verified as vertices of the graph** (4 of 20 in the
spent set did not match any chain within 25 m, which is a loss of power).

## How a candidate is accepted

Fitted on dev data, then read once on the fresh set and once on the calibration test half:
- Fresh set: Spearman of `worth` with fun positive for both raters and above 0.3 over all roads; classics above lanes in
  at least 70 % of the pairs whose worth differs by 1.5 or more (today 0 of 63); the great tertiary group scored above
  the lanes (the guard against a class shortcut). The plan reports every number even if only some are met.
- Calibration test half: overall and fast-sweeper agreement not below the baseline by more than the bootstrap interval;
  no stretch labelled 1 or 2 above 0.3 fun; concordance on pairs 1.5 apart does not fall by more than 0.03.
- Scale: the rating bands (`ratingOf`), `CURVY_EDGE_SHARE` and the stop rules (`minScoreGain` 3,000 fun-m) are all in the
  fun scale, so a change of scale moves candidates and slider stops. Anchor: the mean graph fun of the 28 bench great
  roads and the km at rating 4-5 in Spain stay within a stated margin (+-10 %), or the constants that depend on the scale
  are listed with a measured effect. Nothing else retuned inside this plan.
- Bench (scratch data run on `main` + the change, never the shared data): **zero G1 losses** (any G1 change goes to the
  maintainer), recall at the baseline's or better, settled nodes up at most 10 %, `graph.bin` growth under 1 MB (fun is
  already stored; no growth expected).
- The accepted village lanes (Sort, Tremp: ROADMAP, 2026-10-15) and the València -> Los Santos "no red" case before and
  after; anything that lowers the village lanes goes to the maintainer with shots, as agreed for the two-sided plan.

## Before and after (all reported, none tuned to)

- The nine lanes and seven classics of the spent set; the five classics named by the expert (N-260 Cotefablo and
  Foradada, N-621 Hermida, AS-114, N-110 Tornavacas-Jerte, CV-800) and the lanes (LLN-, PI-, CB-, CO-, HF, SC-222) in
  km at fun >= 0.8 and 0.92, by class; Spain-wide km that change rating band, by class and region.
- Overlay shots main against change: Pyrenees (Jaca -> Benasque), Asturias (Santander -> Oviedo), València -> Los Santos,
  at the Huawei's viewport in headless Chrome; the maintainer looks.
- Head-to-head: expert-rider blind on Jaca -> Benasque and Santander -> Oviedo, only if the fresh set passes.

## Impact that is not obvious

- `curvy_intervals` (twisties, the overlay and the ride summary) still decides what is a "twisty" by 120 deg/km, so a
  fast sweeper under that density gets fun but not a highlighted twisty; candidates (`candidates.ts`) detect curvy edges
  by their fun share and will follow the new fun. Whether the 120 deg/km threshold also becomes speed-aware is a second
  step, decided after the fun numbers (it moves the overlay, the ride summary and the twisty counts).
- The pipeline fun is computed in two places (`graph.py`, per way, and `twisties.py`, per chain with `pace_factor`):
  both take the same function and the same speed, or the overlay and the planner disagree.
- Candidates and slider stops are cached in `candidates.bin`, which is rebuilt with the graph (`make data`).

## Leads from the -ends trips (separate from this plan, for the ROADMAP)

Six roads are demanded and missed on their own `-ends` trip: C-462 Tuixent-la-Seu (76 min), GIV-5221 (70), JV-7032
(41), CV-70 Confrides (40), CV-345 Alpuente-Titaguas (33) and N-502 Puerto del Pico (12 min: a short detour no stop
rides). Each needs the Santander -> Oviedo kind of measurement (selection, cap, dominated or not) before anyone says
why; N-502 first, because 12 minutes is far under any cap. Measure-only, not part of the fun change; it may move after
this plan because a new fun scale changes which roads dominate.

## Cost

| Step | Work | Machine |
| --- | --- | --- |
| 1 Harness: per-vertex speed in the chain cache (class, posted limit), `lateral_fun`, bootstrap, the fresh-set scorer | half a day | chain cache ~4 min in a slot |
| 2 Fit family 1-3 on dev data, table per step | a day | seconds per candidate |
| 3 Fresh held-out + calibration test half, once; verdict | 2 h, after road-scout delivers | seconds |
| 4 If a candidate passes: pipeline run on the change, overlay, candidates, bench; before/after tables and shots | a day | build ~18 min + bench 30 s per slot |
| 5 `expert-rider` blind on the roads that moved most; maintainer's look | the subagent + the maintainer | |

About three working days if a candidate passes, one and a half if the dev step says "no change" and stops. Nothing lands
before the maintainer has seen the shots.

## Needed from the director

1. Approval of the family, the order and the acceptance rule, including that "no change" is an allowed answer and that the
   calibration test half is a guard, not the target (the maintainer's aim is worth).
2. road-scout: the fresh held-out set above (24 roads, three groups, vertices verified), delivered before step 3.
3. Whether the second step (speed-aware 120 deg/km threshold for twisties) is in this plan or a separate one.
