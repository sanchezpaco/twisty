# Fun calibration, step (d)-2: no candidate beats the current curve on the dev half (measured)

Date: 2026-10-15. Plan: `plans/2026-10-15-fun-calibration-step2.md` (approved by the director). Nothing in the model was
changed. Data: chains of the pipeline at `439c230` (the stack's data (a)+(c)+(b) plus the chain join of step 1), the
calibration set of road-scout (`data/calibration/calibration-set.json`) with the expert's blind labels for 40 stretches.
Scripts, kept out of the repo in `.claude/handoffs/routing-scripts/`: `cache_chains.py`, `fit_curve.py` (loader, metrics,
bootstrap), `fit_dev.py` (grid), `fit_paired.py` (paired bootstrap), `fit_flow.py` (sinuosity), `features_dev.py`.

**The test half was not read.** No candidate reached the dev gate, so there was nothing to accept; the test half stays
closed for the next change of the model.

## How it was measured

- Label of a stretch: road-scout's character, or the mean of both raters where the expert also rated it (18 of the 81 dev
  stretches). The metric is the rank (Spearman), never the absolute character.
- A stretch is the chain between the two ends of the set (within 50 m), cut there and scored with the model's own
  functions (`turning_profile`, the 1 km window, the fun curve). 62 of 81 dev stretches matched. The 19 that did not enter
  with fun 0: 17 are urban avenues and motorways (not twisty-eligible, so 0 is what the pipeline gives them) and 2 are real
  roads whose stretch crosses a chain break (N-432A Sierra Morena, CC-135 Las Hurdes, both labelled 3): the baseline is a
  little worse than it would be with them cut across the break.
- Metrics: Spearman overall and per class, the share of stretch pairs with labels at least 1.5 apart that the model orders
  right, and a guard on the stretches labelled 2 or less. Bootstrap: 1,000 resamples of the stretches.

## Baseline, dev half, current model (curve 40 → 0, 150 → 0.55, 500 → 1; 1 km window)

| | n | Spearman | bootstrap 95 % |
| --- | --- | --- | --- |
| all | 81 | 0.74 | 0.59 to 0.85 |
| mixed | 42 | 0.22 | -0.10 to 0.51 |
| fast sweepers | 13 | 0.59 | 0.10 to 0.88 |
| hairpin stacks | 5 | 0.32 | -1.0 to 1.0 |

Pairwise concordance on pairs 1.5 apart: 0.94. Largest fun among the stretches labelled 2 or less: 0.29. (The overall
figure is higher than the 0.47 of the first plan because it includes the 19 urban and motorway stretches at fun 0, which
a rider and the model both rank at the bottom; the matched-only figure was 0.47.)

## Candidates

Grid on the dev half: the inner point of the curve (x1 in 60-250 °/km, y1 in 0.2-0.85) and the second breakpoint (x2 in
250-1000 °/km), each with the 1 km window alone ("plain") or the larger of the 1 km and the 300 m windows ("max"): 2 × 148
curves. Guard: no stretch labelled 2 or less above 0.3.

| Candidate (best inside the guard) | Δ all | Δ mixed | Δ sweepers | Δ hairpin |
| --- | --- | --- | --- | --- |
| plain: 250 → 0.35, 500 → 1 | +0.004 (-0.005 to +0.015) | +0.010 (-0.007 to +0.037) | 0.000 (0 to 0) | 0.000 (0 to 0) |
| max: 250 → 0.2, 1000 → 1 | +0.010 (-0.015 to +0.041) | +0.009 (-0.068 to +0.097) | +0.03 (0 to +0.19) | -0.22 (-1.16 to 0) |

(Δ is the mean of the paired bootstrap, with its 95 % interval.) Both are inside the interval of the baseline on every
class, and the 15 best curves of the grid are within +0.01 of the baseline overall: **the curve is flat against these
labels**. Some of the top curves break the guard (for example 80 °/km → 0.55 gives a stretch labelled 2 or less 0.53).

Flow term (family 3), one measurement: the sinuosity of 300 m, 1 km and 3 km windows (path over chord) instead of the
turning. Spearman on the dev half, all / mixed / sweepers: sin 300 m 0.75 / 0.25 / 0.59, sin 1 km 0.74 / 0.28 / 0.62, sin
3 km 0.75 / 0.35 / 0.65, against 0.74 / 0.20 / 0.59 for the turning density of the same stretches. It is the best of the
summaries, and still inside the interval of the baseline on mixed (-0.10 to 0.51): with 42 stretches labelled
3-4.5 by raters who agree exactly on 12 of 40, it cannot be told from noise, and it would add a computation to every
graph window.

## What stays open (not a cause, a measurement)

- The stretches the model gets wrong by a wide margin are the same under every candidate: roads labelled 4 at 120-220 °/km
  (NA-137 Belagua, C-1412b Comiols, NA-1210 Belate, A-1178 Filabres, AL-4404 Calar Alto) and labelled 3 at 430-570 °/km
  (CA-281 Nansa, A-366 Yunquera, CM-412 Riópar and Crucetas, CA-184 Piedrasluengas). Density and sinuosity at any of
  the scales tried do not separate them. What would: unknown. The pipeline has no gradient, altitude, width or surface
  for these roads, so those were not tried.
- The 5 hairpin stacks of the dev half cannot say anything (interval -1 to 1); the 6 of the test half will not either. AS-227
  (the reason for this work) is not in the set, so it was not tuned to; step 0 measured it at 0.71 and the candidates
  were not run on it.

## Verdict

**No change to `curvature.py`.** The plan's acceptance rule asks for a gain that clears the baseline's interval on the mixed
class, the sweepers and the hairpins; none does, and the bench has no headroom to ask for. AS-227 stays a by-product of
the candidate machinery (rated 0.45-0.67 per chain, none at 0.8), fragile but not lost (zero G1 holds today). The
calibration set stays valid for the next candidate (a per-road speed or gradient term, if the pipeline ever carries one);
the test half is unread.
