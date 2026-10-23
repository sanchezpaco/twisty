# Plan: flowing classics in the value of a road (maintainer's choice 1)

Status: step 1 landed on main (463a6bc, 2026-10-16) and town crossings (E) with it; step 2 tried at k = 2, failed the
bench, closed with no change (maintainer, 2026-10-17). Owner: `routing`. Date: 2026-10-16. Brief:
`.claude/handoffs/brief-routing-flow.md`. Follows `reviews/2026-10-16-road-value-relief.md` (on the held-out set today's
value orders classics below lanes: Spearman -0.11/-0.12, classics above lanes in 12 % of pairs).

Measured on the v1 data (`graph.bin` sha256 `4d4ec618080a`) and a chain cache of the current pipeline code (282,325
chains, each vertex with the speed it is ridden at and the fun weight of its way). Scripts, git-ignored:
`.claude/handoffs/routing-scripts/flow_chains.py`, `flow_diag.py`; the table is in the session scratchpad
(`flow/diag.txt`). The roads: the kit's and the bench's classics (Lunada, Puerto del Pico, La Hermida, Beyos, Cantó,
Bonaigua, Ronda-San Pedro, La Ragua), the sweepers guard (N-111, A-367, N-260 Cotefablo, AS-114, N-110, CV-800), the
tight great roads and the council lanes of the lanes guard. The spent held-out sets are not used here.

## 1. Where the curve model loses the flowing classics

Fun share of each road, the same ref (or name) and box on both sides:

| road | class | graph today | chain, same gates | chain, no gates | km by heading change: <40 / 40-150 / 150-500 / >500 deg/km |
| --- | --- | --- | --- | --- | --- |
| N-502 Puerto del Pico | trunk | 0.39 | 0.56 | 0.73 | 0 / 11 / 76 / 11 % |
| N-621 Hermida | trunk | 0.43 | 0.52 | 0.55 | 6 / 28 / 67 / 0 |
| N-625 Beyos | trunk | 0.70 | 0.77 | 0.81 | 1 / 5 / 68 / 25 |
| N-260 Port del Cantó | primary | 0.51 | 0.59 | 0.62 | 3 / 31 / 53 / 13 |
| C-28 Bonaigua | primary | 0.40 | 0.48 | 0.52 | 8 / 39 / 30 / 23 |
| N-260 Cotefablo-Foradada | trunk | 0.30 | 0.38 | 0.41 | 21 / 37 / 38 / 4 |
| AS-114 Panes-Cangas | primary | 0.33 | 0.39 | 0.41 | 5 / 58 / 38 / 0 |
| N-110 Tornavacas-Jerte | trunk | 0.21 | 0.24 | 0.33 | 28 / 43 / 19 / 9 |
| N-111 Iregua | trunk | 0.25 | 0.27 | 0.27 | 29 / 51 / 20 / 0 |
| A-367 Ronda-Ardales | secondary | 0.14 | 0.14 | 0.17 | 36 / 58 / 7 / 0 |
| CV-800 Carrasqueta | secondary | 0.46 | 0.49 | 0.50 | 9 / 24 / 67 / 1 |
| Vidrà, Tost, Mare de Déu, Santa Engràcia, CV-363, JV-7032, Palomas | tertiary | 0.87-0.99 | 0.89-0.99 | 0.90-0.99 | 0 / 0-3 / 25-68 / 32-94 |
| CV-345 Villar-Alpuente, Alpuente-Titaguas | tertiary | 0.46, 0.35 | 0.44, 0.40 | 0.50, 0.45 | 10 / 34 / 54 / 2 |
| lanes LLN-, PI-, CB-, CO-, SC-222, HF | tertiary | 0.49-0.95 | 0.52-0.95 | 0.68-0.96 | 0-1 / 0-13 / 26-71 / 25-74 |

Three causes, measured, in order of size:

1. **A defect: the graph clips the curve window at every OSM way end.** `graph.py` computes the curve fun of each way on
   its own profile, and `_window_density` treats the unseen part of a short way's window as straight. Roads split into
   many short ways (bridges, tunnels, changes of limit or lanes) lose fun they have along the road: Puerto del Pico
   0.39 against 0.56 with the same gates along its chain, Hermida 0.43 / 0.52, Cotefablo 0.30 / 0.38, Cantó and
   Bonaigua +0.08, AS-114 +0.06. The tight great roads lose 0.00-0.04 (their ways are long), the lanes about as much.
   Spain-wide the clipping costs every class (graph against chain, same gates): trunk 0.093 / 0.104 (+12 %), primary
   +10 %, secondary +8 %, tertiary +8 %, unclassified +7 %; the loss is concentrated on the heavily split roads. The
   overlay's twisties are already computed on chains (`twisties.py`), so today the overlay and the planner disagree.
2. **The curve mapping does not know speed.** The flowing classics have 30-60 % of their km between 40 and 150 deg/km,
   where `fun_fraction` gives 0 to 0.55, whatever the speed; the pace factor is 1 for every class from tertiary up, so
   it neither helps nor hurts them. A trunk at 85 km/h and a lane at 60 with the same heading change per km score the
   same, although the bends of the first ask far more of the rider.
3. **Gates**, not touched: one-way ways have no fun by the rider-safety rule (the graph is undirected), which costs
   the passes whose climb is mapped as two carriageways (Pico 0.56 -> 0.73 without gates, N-110 0.24 -> 0.33).
   Town crossings at 50 km/h or less are zero on purpose. This is a safety decision, out of scope here.

The run logic plays a smaller part: the twisty overlay and the ride summary need 120 deg/km over 4 km
(`curvy_intervals`), so N-111 and A-367 have no twisty at all (0 % of their km); the planner's candidates need an edge
fun share of 0.4 (`CURVY_EDGE_SHARE`), so a sweeper at 0.25 is never a candidate ride. Both follow the fun once it rises.

**Family 2** (`fun-fam2-exp`, fun = max(curve, lateral load)): its signal cannot lower any road (a max), so the four G1
losses it caused were in the combination, measured in `reviews/2026-10-16-quality-score.md` and
`-thinning-great-rides.md`. Vidrà on regional-024: the routes that ride it fell from 31 to 1 because the appetite routes
bent to the raised classics. CV-363 and CA-9104: still on the frontier but dropped by the stop thinning, fixed on main
since by the great-ride rule. CV-345 Alpuente-Titaguas: not a candidate at all (43 % curvy). So any credit for classics
carries the Vidrà risk: raised classics beat it on the trips where both are a choice. The bench shows it, and a G1
loss goes to the maintainer. Family 2 is also weak where it is needed: its load threshold (0.4 m/s2) leaves
the primaries and secondaries almost where they were (AS-114 +0.01, CV-800 +0.01, A-367 0).

## 2. Step 1: the curve fun along the road, not along the way (the defect, no constant)

- The graph takes each vertex's curve fun from the chain the way belongs to (`build_chains` already joins the ways of
  one road through way splits, and `twisties.py` already uses it); the way's own gates and weights (`fun_weight`) are
  applied as today, per way. Ways that are not in a chain (roundabouts, links, motorways, residential connectors,
  tracks) keep today's per-way profile. `Chain` records which way each slice of its vertices came from.
- No new constant. Graph shape unchanged (fun is already stored). The overlay does not move (twisties are chains).
- Tests: a curvy road split into short ways has the same fun as the same road in one way; a gate still zeroes its own
  way only; the graph and the twisties give the same fun to the same chain.
- Measured on a scratch rebuild: the bench (G1, recall 62/110 and 8/22, lanes and sweepers guards, settled nodes), the
  scale (mean fun of the great roads, km at rating 4-5, which stop rules move), and the table above again.
- It is a defect fix, so it lands on the bench gates alone if you agree; or it goes in with step 2 under the step 2
  tests. Either way step 2 is measured on top of it.

### After step 1: what the chain window reads across joints and town crossings (review finding 4)

Measured on main's chains (2026-10-16, `.claude/handoffs/routing-scripts/flow2_joints.py`), graph fun share of the open
km under four rules: per way (v1), along the chain (step 1), the chain with the heading change at joints between ways
zeroed (B), the chain with the heading change on town crossings (built-up ways with no fun) zeroed (E).

| | per way | chain | B joints zeroed | E towns zeroed |
| --- | --- | --- | --- | --- |
| Hermida, Cotefablo, La Ragua | 0.50, 0.33, 0.65 | 0.60, 0.41, 0.71 | 0.58, 0.40, 0.69 | 0.58, 0.41, 0.71 |
| tight great roads | 0.39-0.99 | 0.46-0.99 | -0.00 to -0.02 | -0.00 to -0.01 |
| lanes guard (LLN-, SC-222, HF) | 0.71, 0.75, 0.64 | 0.76, 0.81, 0.68 | 0.75, 0.79, 0.68 | 0.76, 0.80, 0.68 |
| Spain, all chained open km | 0.256 | 0.288 | 0.279 | 0.285 |
| open km within 500 m of a town crossing (7,900 km) | 0.162 | 0.298 | 0.254 | 0.217 |

- **Joints: no gain, not done.** Zeroing them lowers classics, tight great roads and lanes alike (Spain -3.2 %).
- **Town crossings: fixed (E, director).** About 60 % of what step 1 added next to towns was the town's own corners
  (crossroads, the road winding through the village) read into the open road's window, although the crossing itself
  has no fun (P-131 near a village 0.14 / 0.40 / E 0.19). The heading change on town crossings is now zeroed before the
  window, in the graph and the twisties; one-ways and gated ways keep feeding their neighbours (they are road).

## 3. Step 2: the bend scored at the speed the road is ridden at (one constant)

`fun = fun_fraction(heading change per km x max(1, v / SPEED_REF_KMH) ** FLOW_SPEED_POWER)`, with `v` the speed the road
is ridden at (class cruising speed capped by the posted limit, per vertex, the same in graph and twisties) and
`SPEED_REF_KMH` = 60, the top of `PACE_SPEED_KMH` (already there, so not a new constant). One new constant,
`FLOW_SPEED_POWER` (k). What it does by construction:

- **Roads ridden at 60 km/h or less are unchanged**: every tertiary road, so the tight great roads and the council
  lanes cannot move (not lowered, not raised), and every posted-slow stretch.
- Faster roads see their bends as tighter: at k = 1 a trunk at 85 km/h counts 100 deg/km as 142; at k = 2 as 200
  (k = 2 is the lateral load kappa v^2 relative to 60 km/h, without family 2's threshold).
- Straights stay straight (40 deg/km on a trunk is still under the curve's zero at k = 1, 80 at k = 2).

As tried (director, 2026-10-16; branch `flowing-fun-k2-exp`, b7d26a2, kept as evidence): each bend's heading change
is multiplied by the factor of the speed at its own vertex, before the 1 km window, so a posted-slow bend is never
raised by faster neighbours (the same as the formula above at constant speed). At a vertex two ways share, the lower
speed. Ways on no chain (roundabouts, links, motorways, streets, tracks) keep their own profile, unscaled. The twist
(deg/km) a twisty shows stays the road's own geometry.

**k chosen on physics, not fitted (director, 2026-10-16): the fit set is one-sided above 60 km/h.** The fit below ran as
planned on the E base (town corners zeroed; `.claude/handoffs/routing-scripts/flow2_fit.py --towns`, a chain-level
harness that gives the step 1 graph's own fun at k = 0). The mechanism only moves roads ridden above 60 km/h, and the
set holds 41 such good roads against 1 such lane, so the AUC rises with k by construction and is no evidence:

| k | 0 | 1 | 2 | 3 | wider look: 4 / 5 / 8 |
| --- | --- | --- | --- | --- | --- |
| AUC good vs lanes, pairs inside a region | 0.500 | 0.554 | 0.607 | 0.651 | 0.679 / 0.711 / 0.764 |
| great roads' mean (bar: moves < 15 %) | 0.753 | 0.785 | 0.809 | 0.827 | 0.841 / 0.852 / 0.871 |
| neither: N-232, CV-35, A-461 (bar: under the lanes' 0.728) | 0.25, 0.30, 0.08 | 0.35, 0.40, 0.16 | 0.45, 0.51, 0.27 | 0.55, 0.61, 0.39 | CV-35 0.69 / 0.75 / 0.88 |
| Spain fun share: trunk, primary, secondary (tertiary 0.453) | 0.14, 0.21, 0.31 | 0.22, 0.27, 0.34 | 0.32, 0.33, 0.38 | 0.42, 0.40, 0.41 | |
| trunk km in 2 km pieces at fun >= 0.5 | 1,104 | 2,049 | 3,444 | 5,000 | |
| Hermida, Cotefablo, AS-114, N-111 | 0.58, 0.41, 0.41, 0.27 | 0.74, 0.54, 0.50, 0.40 | 0.84, 0.65, 0.59, 0.50 | 0.90, 0.74, 0.68, 0.60 | |

Leave-one-region-out every fold takes the top of the grid (AUC 0.651 against 0.500). The guards first bind at k = 5.
k = 2 has a meaning of its own (a bend weighed by its lateral load, curvature x speed squared, relative to 60 km/h); it
takes the passes into the tight-road range, keeps the ordinary fast roads under the lanes and the trunks under the
tertiary average. The tight great roads and the lanes guard do not move at any k (CV-70 Confrides, a primary, 0.83 ->
0.92). The held-out read judges k = 2 once; if it fails, no second read at another k.

**Result: no change (maintainer, 2026-10-17).** k = 2, rebuilt in scratch on the E base, failed the bench, so the
held-out read was not run: `flow-holdout.jsonl` and the 25 fresh trips stay unspent. Bench against main (127 trips):

- G1 19 lost / 4 gained; recall 62 -> 48 of 110 on the tuning set, 6 -> 5 of 22 on the holdout.
- Twisty km of the default stop 108 trips better / 12 worse (+2,420 km), extra minutes -2.7 %, motorway and trunk km
  of the default stops 11,963 -> 10,773; overlay against E 5,329 -> 5,915 twisties, 17,192 -> 21,168 km at rating 4-5.
- Cause, measured (`.claude/handoffs/routing-scripts/lost_diag.ts` on the k = 2 scratch data, per lost road the old
  riding stop against the new nearest stop): every lost road keeps its own fun (tertiary, unmoved by construction);
  the slot now rides a raised fast road nearby instead. Vidrà (0.97) for the N-260 Olot-Ripoll (0.23 -> 0.38), Lunada
  for the N-629 (0.54 -> 0.79), C-462 Tuixent for the C-26 (0.60 -> 0.79) and C-55 (0.29 -> 0.52), CA-9104 Palomas for
  the A-374 (0.18 -> 0.39).

The limit is the stop rules, not the value: one appetite route per slot, so a raised fast pass takes the slot of a tight
road. The next lever is the planner (`plans/2026-10-16-orienteering-planner.md`, ROADMAP Next up 10).

First look, not a fit (chain profiles, today's gates): k = 1 / k = 2 take Hermida 0.52 -> 0.65 / 0.73, Cotefablo 0.38 ->
0.50 / 0.59, AS-114 0.39 -> 0.47 / 0.55, N-111 0.27 -> 0.39 / 0.49, Cantó 0.59 -> 0.68 / 0.75, CV-70 0.80 -> 0.85 / 0.89;
A-367 only 0.14 -> 0.17 / 0.21 (most of it is under 100 deg/km: no speed makes that a twisty road in this model); every
tertiary road the same.

**Fit** of k on a grid (0.5 to 3), on the fit set of the relief work (234 cleaned roads, 7 good counter-examples),
leave-one-region-out, scored by the AUC of good roads against lanes over pairs inside one region (across classes, since
the mechanism moves the fast classes only), under two guards: the wide-class roads road-scout marked "neither"
(N-232, N-435, A-461, the CV-35 autovía: ordinary fast roads) may not rise above the mean of the lanes; and the mean fun
of the great roads moves less than 15 %. If the fit wants the largest k allowed, the choice and its cost come to you as
the floor did last time.

## 4. Tests, fixed now, before any fit

1. **The new held-out set** (`data/calibration/flow-holdout.jsonl`, road-scout, read once after the candidate is fixed;
   matching done without model values: 17 clean by ref, 9 by their ends and doubtful, 4 unmatched, being corrected by
   road-scout). Computed with and without the stretches that overlap roads already used in the kit or the fit
   (A-369, A-366, AS-260, A-372, CV-700, N-260 Toses). Bar, both raters, on the matched set:
   - classics above lanes in at least 70 % of the pairs (relief: 12-14 %);
   - Spearman of worth with the value positive and above 0.3 over all stretches;
   - tight great roads above lanes in no fewer pairs than today (the mechanism cannot change this pair by
     construction; a drop would mean step 1 hurt them);
   - classics above tight great roads reported, not a bar (the maintainer wants both kinds).
2. **The spent held-out set** (`speed-fun-holdout.json`), reported as a secondary check only, never tuned on.
3. **The 25 fresh trips** (`app/bench/eval/out-of-sample.json`, unspent): v1 and the candidate (steps 1 and 2), default
   and most-fun stops mixed blind in one dossier (`eval --trips --data v1,candidate`), judged by you, absolute 1-5. Bar:
   the candidate's mean not below v1's, and up on the trips whose route changed.
4. **The kit** (v1 frozen lists): pairs and sample against v1 and v2, reported with the note that it is partly in sample.
5. **The bench**: zero G1 (a G1 loss goes to the maintainer; Vidrà on regional-024 is the known risk); recall 62/110 and
   8/22 no worse; lanes guard (LLN-, PI-, CB-, CO-, HF, SC-222) level by construction after step 1; sweepers guard
   (N-111, A-367, N-260, N-621, AS-114, N-110, CV-800) up; default-stop extra minutes not up more than 10 %; km of
   motorway and trunk in the stops reported (raising trunks may pull routes onto them); settled nodes; graph size
   unchanged; the overlay's twisties and km at rating 4-5 before and after (step 2 moves the overlay).

Acceptance: the held-out bar and the fresh trips both met, the bench clean. Otherwise "no change", reported as such.

## 5. Steps and cost

| step | work | machine |
| --- | --- | --- |
| 1 Chain-based curve fun in `graph.py` (and `Chain` keeping its ways), tests | half a day | none |
| 1b Scratch rebuild, candidates, bench, the table again | an hour | ~17 min build + bench, one heavy slot |
| 2 Speed-scaled heading change behind `FLOW_SPEED_POWER`, tests | half a day | none |
| 2b Fit k on the fit set (a chain-level harness, no rebuild per k) | two hours | minutes |
| 3 Held-out read once; scratch rebuild of the candidate; bench | two hours | one slot |
| 4 Fresh-trips dossier and the kit dossier; you judge | an hour of mine | minutes |

## Needed from the director

1. Approval of the two steps and of the tests and bar above, before anything is built.
2. Whether step 1 lands on the bench gates alone (my proposal: it is a defect, and the overlay already uses chains).
3. road-scout's corrected and added held-out lines, matched by the same rule before the read.
