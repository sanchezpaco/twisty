# Plan: step (d)-2, the curve, fitted on the calibration set

Status: for the director's approval, nothing fitted. Owner: `routing` as `gis-data-engineer`. Date: 2026-10-15.
Follows `plans/2026-10-14-fun-calibration.md` (step 0 and step 1 done: `reviews/2026-10-14-fun-calibration-step0.md`,
439c230). The calibration set is `data/calibration/calibration-set.json` (road-scout, 164 stretches of 1.5-3 km, 15
regions, split by region: dev 81, test 83) with `blind-labels-expert.json` (expert-rider, 40 medium-confidence stretches).

## How the set is read

- **Label** of a stretch = the road-scout character (1-5), or the mean of both raters where the expert also rated it
  (40 stretches, 18 of them in dev). The expert is +0.6 higher on average (+1 on 25 of 40, within ±1 on 39): a scale
  offset, not a disagreement of order, so the metric is on **rank**, never on absolute character.
- **Class tags are soft** (the expert tags several "mixed" as hairpin stack: 29 of 40 agree). They are used to report
  and to guard (urban, straight), not to fit.
- **val-ares** (test, road-scout 3, expert 5) is flagged to road-scout for a third look; it stays in the set, and the
  acceptance numbers are also given without it.
- The test half is read once per step, at acceptance (the dev half is all this plan has touched so far).

## Harness (kept out of the repo, `.claude/handoffs/routing-scripts/`)

`score_baseline.py` and `features_dev.py` (both already run): cache the chains of the current pipeline code once
(`cache_chains.py`, 282,227 chains, ~4 min in a heavy slot), find for each stretch the chain that has both ends
within 25 m, cut it between them, and score it with the model's own functions (`turning_profile`,
`cumulative_fun_m`). Metrics: Spearman against the label over all matched stretches and per class, mean model fun per
label, the biggest rank gaps, and the **pairwise concordance on pairs whose labels differ by 1.5 or more** (what a rider
would notice). Candidates are evaluated by calling the same functions with other constants, so a fit never needs a
pipeline run.

Coverage today (dev, 81 stretches): 60 matched. Of the 21 missing, 18 are urban avenues and motorways (`A-2`, `AP-4`,
`A-67`, ...): not twisty-eligible, so they have no chain and fun 0 by class, which is right; they enter the metric with
fun 0 from the graph's edge classes. Three are real roads that cross a chain end (N-432A Sierra Morena, CC-135 Las
Hurdes, N-145 Seu d'Urgell): these are cut from the graph's edge geometry instead (the set's ends are graph vertices).

## Baseline, dev half, current model (measured with the harness above, 60 matched)

| | n | Spearman label vs model fun |
| --- | --- | --- |
| all | 60 | 0.47 |
| mixed | 40 | 0.16 |
| fast sweepers | 10 | 0.34 |
| hairpin stacks | 5 | 0.32 |
| straight | 5 | 0.40 (mean fun 0.05: the model agrees) |

Mean model fun per rounded label: 1 → 0.03, 2 → 0.21, 3 → 0.65, 4 → 0.77, 5 → 0.91 (n = 4, 3, 19, 32, 2). The model
orders the ends of the scale (dull and urban at the bottom) and almost does not separate 3 from 4 from 5.

Candidate summaries of the turning, same 60 stretches (Spearman with the label, all / mixed only):

| summary | all | mixed |
| --- | --- | --- |
| heading change per km, no simplification | 0.49 | 0.15 |
| same, simplified at 2 / 5 / 10 m | 0.47 / 0.46 / 0.44 | 0.11 / 0.11 / 0.07 |
| largest 300 m window, no simplification / 5 m | 0.53 / 0.50 | 0.20 / 0.12 |
| model fun (1 km windows, 5 m, 0 to 1 curve) | 0.47 | 0.16 |
| sinuosity (road length over straight distance) | 0.51 | 0.31 |

What this says, as measurement and not as cause:

- **The simplification tolerance and the window matter little** (±0.03 overall), as step 0 found on AS-227. No setting
  of them moves the mixed class.
- **The mixed class is where the model cannot rank**: 40 of the 60 stretches are labelled 3-4.5 at 150-570°/km, and the
  labels hold little of that spread. Two groups sit far from the model: roads labelled 4 at only 120-220°/km
  (NA-137 Belagua, C-1412b Comiols, NA-1210 Belate, A-1178 Filabres, AL-4404 Calar Alto) and roads labelled 3 at
  430-570°/km (CA-281 Nansa, A-366 Yunquera, CM-412 Riópar and Crucetas, CA-184 Piedrasluengas).
- The expert's disagreement with road-scout (only 12 of 40 exact) says the ceiling for this set is low: a label is good
  to about ±1, so a rank agreement of 0.5-0.6 on the mixed class may be all the data can show.

## The family (at most three named constants at the top of `curvature.py`)

Chosen from the table, tried one at a time and then together, on the dev half:

1. **Curve breakpoints** (`FUN_CURVE_DEG_PER_KM`/`VALUE`): the two inner points (150 → 0.55, 500 → 1.0), as a pair;
   today the curve is flat from 500°/km, which is where most of the mixed class sits.
2. **Scale of the judgement**: fun taken as the larger of the 1 km window and a 300 m window (`WINDOW_M` plus one
   shorter window), the "largest 300 m" row above.
3. **A shape term for flow**: a term from the road's overall winding (sinuosity over the window, or its speed
   equivalent from the class pace) that lifts the fast sweepers and lowers the narrow, slow bends, the two groups above.
   Tried only if 1 and 2 leave the mixed class under the noise ceiling; the term must be computed from the geometry the
   pipeline already has, and be cheap enough for the graph build.

The deflection cap (150°) and the simplification tolerance stay where they are (rejected as causes in step 0, and the
table above); they come back only if a candidate needs them.

## How a candidate is accepted

Fitted on the dev half, then read **once** on the test half:

- Rank agreement on the test half improves on the mixed, fast-sweepers and hairpin classes and overall, by more than the
  bootstrap interval of the baseline (bootstrap over the stretches, 1,000 resamples, reported with the numbers). With 40
  mixed stretches the interval will be wide: **if no candidate beats it, the answer is "leave the curve as it is"** and
  that is reported instead of a change.
- Urban, dull and straight labels: mean fun does not rise (no tolerance above today's), and no stretch labelled 1 or 2
  gets more than 0.3.
- Pairwise concordance on pairs with labels 1.5 apart does not fall.
- The bench loses no road it finds today (recall, G1, G6, D3 on the (a)+(c)+(b)+(d) data), graph.bin grows by at most
  1 MB, and the build time of `graph.py` does not grow visibly.
- AS-227 and N-260 are not in the set; they come back through the model (their fun is reported, not tuned to).
- Then `expert-rider` blind on the roads whose fun moved most (the stack's gain rule), and the three-region overlay
  shots for the maintainer (Pyrenees, Meseta and urban edge, coast).

## Cost and order

1. Harness completion (the graph-edge cut for the 3 real unmatched roads, bootstrap, pairwise metric): half a day.
2. Fit on dev, one candidate at a time, then the family, with a table per step in a review file: a day at most.
3. Test half once; the verdict (a change, or none) to the director with the numbers.
4. Only then a pipeline run on (a)+(c)+(b)+(d) in a scratch work dir, the bench and the judges. Nothing lands before
   that, and the coverage constants stay frozen until that run, as in the first plan.

## Needed from the director

1. Approval of the family and the acceptance rule above, in particular that "no change" is an acceptable result.
2. road-scout: a third look at `val-ares`, and whether the 25 urban/straight stretches can be read as a guard only.
3. Nothing else: the rebase of the stack onto the new main (open-in landed) is mine and goes after this plan, before
   the pipeline run.
