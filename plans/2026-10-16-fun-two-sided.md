# Plan: the fun model, two-sided (flowing classics up, narrow council lanes down)

Status: for the director's approval, nothing run, no code. Owner: `routing` as `gis-data-engineer`. Date: 2026-10-16.
Source: maintainer, via the director, 2026-10-16 (approved trying it). Evidence:
`reviews/2026-10-15-head-to-head.md` (blind expert, ROADMAP Phase 4b, "Fun model, two-sided"). Queued behind the La Roda
connectors; the connectors' data is the base of every number below.

## What the expert said, and what is measured

- Undervalued fast flowing classics: N-260 Cotefablo and Foradada, N-621 Hermida, AS-114 Panes-Cangas de Onis, N-110
  Tornavacas-Jerte, CV-800 Carrasqueta. On Santander -> Oviedo the N-621 and AS-114 route has 0 km of high fun.
- Overvalued council lanes: LLN-, PI-, CB-, CO- (Asturias, Cantabria), SC-222xx and HF (Huesca), long unnamed stretches.
  Jaca -> Benasque, our default stop: 26 km signed 40 km/h or less against 18 on the fastest route.
- Already known and not repeated here: `pace_factor` is 1 for every class from tertiary up (`BASE_SPEED_KMH` 60 km/h or
  more, `PACE_SPEED_KMH` 40-60), so a council lane mapped tertiary or secondary keeps all of its curve fun, and a
  trunk or primary sweeper gets the same curve value as a lane with the same heading change per km. Step 2 of the
  calibration found no change of the curve mapping (heading per km) that beats the baseline; the signals below are not
  curve-density changes, they are about the road, which is why they are worth a try.
- Not known, to measure first (step 1): the class, `lanes`, `width`, `maxspeed` tag shares of the expert's two lists
  (classics: expect trunk/primary/secondary with a posted limit of 60-90; lanes: expect tertiary/unclassified with no
  width tag, many of them under the 3.5 m `NARROW_WIDTH_M` or `lanes=1`). If the lists do not separate on any tag the
  pipeline has, the answer is "no tag-based signal" and that is the report.

## The signals to try (at most two named constants each, at the top of `roads.py`; none changes `curvature.py`)

1. **Lane floor** (lowers lanes). The fun weight (`fun_weight`) of a way that is narrow, or unclassified/tertiary with no
   `ref` and a council-style `ref`-less name, gets a factor below 1. Variants: by `is_narrow` alone (known to over-flag:
   `lanes=1` on a 5 m trunk, roundabouts; the fix in the ROADMAP item is part of this variant), by class floor
   (tertiary and below with a posted limit of 60 or less), by both.
2. **Flow bonus** (raises classics). A multiplier above 1 (capped so fun stays <= 1) on a trunk, primary or secondary
   way whose posted limit is 60-90 km/h and whose heading change per km is in the flowing band (the 150-500 deg/km region
   where the curve value is 0.55-1.0); variants by class only and by class plus `maxspeed`.
3. Tried alone, then together. A signal that needs a third constant is rejected as too tuned for 164 stretches.

Guard from the earlier decision: the maintainer accepted the village lanes (Sort, Tremp: "good curves count",
2026-10-15). The lane floor must not undo that: report the Sort/Tremp lanes' fun before and after; if signal 1 lowers
them, it is a conflict to take back to the maintainer, not a result to land.

## Scoring (held-out calibration set, test half included)

Same harness as `plans/2026-10-15-fun-calibration-step2.md` (`.claude/handoffs/routing-scripts/`): rank agreement
(Spearman) overall and per class, pairwise concordance on labels 1.5 apart, bootstrap interval of the baseline, urban /
straight guard (no stretch labelled 1 or 2 above 0.3 fun, mean fun not up).
- Fitted (constants chosen) on the dev half; the test half is read **once**, at acceptance.
- The classics and the lanes of the expert are **not** in the calibration set and are not tuned to: they are reported
  before and after, like AS-227 (a fit to six examples would be an anecdote, not a model).
- Ask `road-scout` for held-out stretches of both kinds (10 classics, 10 council lanes, outside the six and the lists
  above), labelled blind, to make the two signals testable on something the fit never saw. Without them the verdict is
  written as "consistent with the expert", not as "validated".
- Acceptance: test-half rank agreement improves on the baseline by more than its bootstrap interval, or the answer is
  "leave the model as it is" (as in step 2, an acceptable result).

## The bench

A scratch data run (never the shared data): pipeline on the connectors' data with the signals, overlay, candidates, then
`run.js run` against `app/bench/baseline.jsonl`. Bar: **zero G1 losses**, recall not below 44 of 125, G6 and D3 as
today, settled nodes not up more than 10 % (the model changes weights, not the graph, so graph.bin stays the same size).
A change in the data is a new baseline, which the director records.

## Before / after

- Table per road (class, km, mean fun, km at fun >= 0.8, rating colour): the six classics, and the lanes LLN-7, AS-340,
  AS-343, PI-11, CB-, CO-3, HF04, SC-22221-03 and one long unnamed stretch.
- Both Spain-wide: how many km move rating band, by class, so a surprise (a whole region reddening or greying) is seen.

## Maintainer's eye

Overlay shots, main against the change, Pyrenees (Jaca -> Benasque) and Asturias (Santander -> Oviedo), the Huawei's
360x780 viewport in headless Chrome (no phone), same camera, with the changed roads named. The maintainer decides what
the maps should look like; the director shows them.

## The head-to-head, re-run

Scripts in `data/head-to-head/` (`h2h.ts`): our six trips re-planned on the new data for Jaca -> Benasque and Santander
-> Oviedo, the competitor GPX scored again unchanged, new blind cards (our default, our most-fun, the best competitor
route, order swapped as in round 2), `expert-rider` blind. Question: does our default stop stop being his bottom pick on
Jaca -> Benasque, and does he rank the Santander -> Oviedo classic route (N-621, AS-114) no worse than ours? Reported
with fun km per extra minute as before.

## Cost in time (machine time is mostly waiting for heavy-job slots, shared with other projects)

| Step | Work | Machine |
| --- | --- | --- |
| 1 Tag survey of the two lists | 1-2 h | one pass over the cached chains, ~5 min |
| 2 Harness additions + fit on dev, signals one by one and together | half a day | seconds per candidate (no pipeline run) |
| 3 Test half once, verdict to the director | 1 h | seconds |
| 4 Pipeline run, overlay, candidates, bench | 1 h of mine | build ~18 min (measured 2026-10-15: 1,070 s with the connectors) plus the slot wait; bench: measured today, to be added |
| 5 Before/after tables, overlay shots | 2-3 h | minutes |
| 6 Head-to-head re-run, two trips, expert-rider | half a day | minutes + the subagent |

About two working days end to end, one if the survey says "no tag separates them" (stop after step 3, report). Steps 4-6
run only if step 3 gives a change worth landing.

## Needed from the director

1. Approval of the signals, the acceptance rule and that "no change" is an acceptable report.
2. `road-scout`: the held-out classics and lanes above (without them the verdict is weaker).
3. The conflict rule for the village lanes (Sort, Tremp): confirm that a lane floor that lowers them goes back to the
   maintainer instead of landing.
4. Note: the director's message said `docs/plans/`; the repository keeps plans in `plans/`, and this file follows that.
