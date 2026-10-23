# The value of a road: relief, fitted and read blind (ROADMAP Next up 9)

Date: 2026-10-16. Plan: `plans/2026-10-16-road-value.md`. Owner: `routing`. Data: v1 (`graph.bin` sha256 `4d4ec618080a`),
DEM `data/raw/dem/` (Terrain Tiles z10). Scripts (git-ignored): `.claude/handoffs/routing-scripts/value_*.py`.
Verdict: **no change.** The relief factor was fitted, fixed before the held-out read (de59580), and failed the bar the
plan set before the read. Branch `road-value` stays unlanded (DEM download step, relief code, the kit's `--trips`
option); the 25 out-of-sample trips (`app/bench/eval/out-of-sample.json`) are unspent, kept for the next candidate.

## First: what today's value does on the held-out set

The held-out set (`data/calibration/speed-fun-holdout.json`, road-scout, with the expert's blind ratings; built for
this question and read for the first and only time here) holds 8 classics, 8 council lanes and 8 great tertiary
roads, each with a `worth` 1-5 from both raters. All 24 matched the graph along their refs. **Today's model orders
them against the riders:**

- Spearman of worth with today's value (curve fun share): **scout -0.11, expert -0.12**.
- Mean value: **classics 0.39, lanes 0.69**, great tertiary 0.70.
- **Classics above lanes in 12 % of pairs**; great tertiary above lanes in 53 % (a coin).
- Pairs whose worth differs by 1.5 or more, ordered as the rater does: scout 42 of 128, expert 31 of 74.

This is the second blind set that says so: the spent two-sided set gave -0.82 (scout) and -0.72 (expert), all nine
lanes above all seven classics (`reviews/2026-10-16-two-sided-survey.md`). The curve fun share is the value of a road
in Twisty, so on roads the model never saw, a rider's worth and the planner's value are unrelated or opposed.

| group | road | class | scout | expert | curve fun today | climb m/km | with relief |
| --- | --- | --- | --- | --- | --- | --- | --- |
| classic | AS-14 | primary | 4.5 | 5 | 0.68 | 47 | 0.64 |
| classic | C-26 | primary | 4 | 4 | 0.65 | 33 | 0.53 |
| classic | NA-178 | primary | 4 | 4 | 0.30 | 20 | 0.24 |
| classic | A-374 | primary | 4 | 3 | 0.22 | 22 | 0.18 |
| classic | A-348 | secondary | 4 | 4 | 0.62 | 43 | 0.56 |
| classic | A-139 | primary | 3.5 | 3 | 0.14 | 16 | 0.11 |
| classic | CL-626 | primary | 3.5 | 3 | 0.04 | 13 | 0.03 |
| classic | EX-203 | secondary | 3.5 | 3 | 0.48 | 23 | 0.38 |
| great tertiary | C-153 | tertiary | 4.5 | 5 | 0.69 | 33 | 0.60 |
| great tertiary | L-401 | tertiary | 4.5 | 5 | 0.76 | 56 | 0.71 |
| great tertiary | LE-2703 | tertiary | 4.5 | 4 | 0.65 | 42 | 0.56 |
| great tertiary | AS-348 | tertiary | 4 | 3 | 0.88 | 73 | 0.86 |
| great tertiary | A-4130 | tertiary | 4 | 4 | 0.83 | 49 | 0.77 |
| great tertiary | AV-913 | tertiary | 4 | 5 | 0.41 | 51 | 0.38 |
| great tertiary | CV-379 | tertiary | 3.5 | 4 | 0.65 | 24 | 0.54 |
| great tertiary | CC-242 | tertiary | 3.5 | 3 | 0.74 | 35 | 0.63 |
| lane | BV-4235 | tertiary | 2 | 3 | 0.53 | 24 | 0.43 |
| lane | NA-2130 | tertiary | 2 | 3 | 0.52 | 28 | 0.44 |
| lane | AS-311 | tertiary | 2 | 3 | 0.75 | 50 | 0.70 |
| lane | OU-0701 | tertiary | 2 | 3 | 0.75 | 32 | 0.62 |
| lane | GR-5206 | tertiary | 2 | 3 | 0.64 | 54 | 0.61 |
| lane | HU-V-3003 | tertiary | 1.5 | 2 | 0.70 | 21 | 0.57 |
| lane | CA-683 | tertiary | 1.5 | 2 | 0.75 | 40 | 0.65 |
| lane | LE-5101 | tertiary | 1.5 | 2 | 0.90 | 60 | 0.88 |

(Curve fun and climb on the stretch as the scout gave it; class is the dominant class of the ref in the graph, read
from the graph, not from the held-out file.)

What the table says, as measurement:

1. **Classics against lanes is a class question in this set.** Every classic is primary or secondary; every lane and
   every great tertiary road is tertiary. The classics are flowing roads whose curve fun is low (0.04-0.68, mean 0.39):
   the curve model scores sweepers as nearly straight, and nothing in today's value knows that a primary road through
   mountains at speed is a ride.
2. **Great tertiary against lanes is not separated by anything measured so far.** Same class, overlapping curve fun
   (0.41-0.88 against 0.52-0.90) and overlapping relief (24-73 against 21-60 m/km). Neither the tags (two-sided survey),
   the speed (speed-aware work), junctions, side ways, buildings, hamlets nor relief (this work) tell them apart.
3. So the next choice is a product one, for the maintainer: what the value of a road should be made of. The data
   suggests two separate questions: (a) a flowing classic needs credit the curve model does not give (the
   speed-aware family failed by taking it from tight tertiary roads; a class or pace credit on primary and secondary
   roads in the mountains has not been tried on this set); (b) a great tertiary road and a council lane may not be
   separable from OSM and a DEM at all, and may need a curated list or the riders' own choices.

## What was tried: relief

**Labels** (`data/eval/road-value/cleaned-labels.md`). 770 road pieces labelled from the judge's text on the kit's routes
and from the R17b side loops; road-scout marked 182 and found the list biased (class and region give the label away,
the R17b pieces are circular). Cleaned to one label per road: 234 roads, 78 good and 156 lanes; R17b pieces, tunnels,
town streets and dual carriageways out. Measured inside one class and one region: today's fun AUC 0.62; the pipeline's
climb per km (1 km window, bilinear DEM) 0.82; hamlets 0.45-0.49 (they were region, dropped); length and elevation
range are artefacts of how the labels were built.

**Counter-examples.** road-scout proposed 15 good roads outside the mountains and 12 mountain lanes; 12 matched the graph
cleanly (7 good, 5 lanes). All 12 lanes are dead ends by the scout's description and stayed out of the fit.

**Fit** (`data/eval/road-value/fit-step3.md`). Three constants: `RELIEF_CLIMB_M_PER_KM` (the climb at which a road keeps
the floor and all of its curve fun) and `RELIEF_FLOOR`. Grid of 585 settings, AUC over good/lane pairs of one class and
region, the great roads' mean value down by at most 10 %, leave-one-region-out. Every floor beat today (0.612); the fit
alone takes the lowest floor allowed (0.742 at 0.5, at the cost of CV-345 -46 %). Chosen with the director: (40, 50),
floor 0.8: leave-one-region-out AUC 0.721, the same ramp in every fold, great roads -8 %, lanes -17 %.

**Held-out read, once** (`speed-fun-holdout.json`): Spearman scout -0.11 -> -0.07, expert -0.12 -> -0.08 (bar: above
0.3); classics above lanes 12 % -> 14 % (bar: 70 %); great tertiary above lanes 53 % -> 52 %. **Not met.** The cause,
measured on the set: its lanes are mountain council lanes (climb 21-60 m/km, mean 38) and its classics are low-relief
flowing roads (mean climb 27). Relief lowers the lowland lanes the judge saw in the kit (Galicia, Andévalo, Penedès,
Jaén) and is not a measure of a road's worth.

## Known limits of this work

- No good road in Galicia in the fit set (the three Galician counter-examples did not match the graph), so no fold
  tests Galicia; no mountain through-lane at all (every mountain lane proposed was a dead end).
- The labels are one session's reading of the judge's sentences, checked by road-scout; the kit's routes are therefore
  partly in sample for any candidate fitted on them.
- z10 DEM: about 120 m a pixel, coarse for a 1 km window.

## What stays

- `make dem` and the DEM cache (`data/raw/dem/`, 1,345 tiles, 159 MB, with `SOURCES.txt`) under the data-policy
  conditions; the relief factor in the pipeline (unlanded). Either is there for a later candidate.
- The kit's `eval --trips --data` option (b90eef9): absolute cards for any trips, versions mixed blind on one reference
  graph. The 25 out-of-sample trips are drawn and unspent.
- Fixed on main from this branch: a fresh `make setup` failed on the flat layout (calibration/ beside the package).
