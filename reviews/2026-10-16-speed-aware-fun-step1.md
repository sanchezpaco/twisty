# Speed-aware curve fun, step 1 on development data

Date: 2026-10-16. Plan: `plans/2026-10-16-speed-aware-fun.md` (approved). Development data only: the calibration dev half
(58 stretches matched with the chain cache of the current code) and the spent held-out set (14 of its 20 roads matched);
the calibration test half, `speed-fun-holdout.json` and its expert ratings were **not read**. Scripts (git-ignored,
`.claude/handoffs/routing-scripts/`): `cache_chains_speed.py` (chains with the speed each vertex is ridden at: class
cruising speed capped by the posted limit), `fit_speed_fun.py`, `fit_speed_fun_f4.py`. The harness scores a stretch with
the production functions and the window density of the pipeline, "today" being the curve x `pace_factor(class)`.

Today on this development data: calibration dev Spearman 0.469 (fast sweepers 0.30, mixed 0.18, pairs 1.5 apart 409 of
456 ordered); spent held-out Spearman with `worth` -0.81 (scout) / -0.67 (expert), 0 of 45 pairs ordered, mean fun
classics 0.53, lanes 0.91.

## Results by family (109 candidates tried: the three constants of family 1 on a grid of 90 settings, with and without
the class pace factor; family 2 in three settings; family 4 in 16, then 15 more in the trade-off table below)

| Family | Best on the held-out | What it costs on the calibration dev half | Verdict |
| --- | --- | --- | --- |
| 1 load at class speed, `a = kappa v^2`, `A0` 0.2-0.6, `A_MAX` 1.5-6, `P` 0.5-1 | -0.53 / -0.49 (8 of 45 pairs); every setting stays negative | 0.34 overall (-0.13), mixed -0.07; no setting keeps the dev half within 0.05 of today | fails: still inverted and costs the mixed class |
| 2 max(today, load) | -0.81 / -0.67, 0 of 45 (identical to today) | 0.45-0.47 (no loss) | cannot lift the order: it only raises the classics, the lanes keep their value |
| 3 load with a speed the road can hold, from tags the pipeline has | covered by the posted-limit speed already in the cache of families 1 and 2; `is_narrow` is 0-1 % on the lanes and 23 % only on HF (two-sided survey) | | no tag to add |
| 4 flow: today's curve x a factor of the *travel* speed (class and posted limit capped by the curves: 25-35 to 60-75 km/h, floor 0.3-0.8) | **+0.21 / +0.41 (27 of 45 pairs)** at v 35-60, floor 0.3; +0.20 / +0.39 at v 25-60 | 0.29-0.32 overall (-0.15 to -0.18), mixed -0.15; at floor 0.6 and above the dev half is kept (0.43-0.47) and the held-out stays negative | the only family that flips the order, and see below |

## Family 4 trades the great roads for the order

The same settings, on the 16 bench great roads that match a chain by their end points (graph fun of the road before and
after):

| v range, floor | held-out scout / expert, pairs | calibration dev | mean fun of the great roads | great roads losing more than 0.15 |
| --- | --- | --- | --- | --- |
| 25-60, 0.3 | +0.20 / +0.39, 24 of 45 | 0.315 | 0.84 -> 0.41 | 15 of 16 |
| 35-60, 0.3 | +0.21 / +0.41, 27 of 45 | 0.291 | 0.84 -> 0.32 | 15 of 16 |
| 25-60, 0.6 | -0.72 / -0.57, 0 of 45 | 0.427 | 0.84 -> 0.59 | 15 of 16 |
| 25-60, 0.8 | -0.76 / -0.62, 0 of 45 | 0.468 | 0.84 -> 0.71 | 4 of 16 (Vidrà, Mare de Déu del Mont, Tost, Santa Engràcia) |

The roads that lose are the tight tertiary roads: Vidrà, Mare de Déu del Mont, Tost, Santa Engràcia, JV-7032, GIV-5221
and the rest. Their travel speed is low for the same reason the council lanes' is: they are tight and tertiary. Any
factor of the travel speed that is strong enough to put the lanes below the classics puts them below Vidrà-like roads
too. This is the third guard of the plan ("great tertiary roads above the lanes") failing on the roads we already have,
and it would be a G1 problem (the fun of the 28 bench roads is what decides which stops ride them), without running
the bench.

## Verdict

No candidate of the family passes on development data:
- 1 and 2 are inverted or unchanged on the held-out order; 1 also costs the mixed class.
- 4 flips the order only by taking the fun away from the great tight tertiary roads, which the maintainer wants
  (Vidrà, Tost, CV-363...). The pairs it orders right are lanes below classics and, in the same move, great tertiary
  roads below classics.
- The structural reason, measured: from the geometry and the class the pipeline has, a great tight tertiary road and a
  council lane are the same object (two-sided survey: same class, same tags; here: same load and same travel speed). The
  fresh held-out set was designed to expose exactly this, and the development data already does.

So the plan's answer is **"no change"**, and the fresh set (`speed-fun-holdout.json`) does not need to be spent on a
candidate that already fails on the guard. The 120 deg/km step (speed-aware twisties) is moot without a fun change.

What would move it, outside this plan: a signal that separates a lane from Vidrà. The data on hand has none (class,
tags, geometry, speed). Candidates for a new signal: how continuous the road is with the network around it (a lane that
ends at a farm against a through road), width as drawn from imagery or `width` tags where they exist, surface
roughness tags, or the maintainer's own flags (a hand-kept list of known lanes, which is a product choice).
