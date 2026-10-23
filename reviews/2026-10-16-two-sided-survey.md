# Fun model, two-sided: step 1, the tag survey

Date: 2026-10-16. Plan: `plans/2026-10-16-fun-two-sided.md`. Data: main (`data/stack-data-g`, graph TWG3, OSM extract
`roads-2a7b7071-located.osm.pbf`). Nothing fitted, no model change. Scripts (git-ignored scratch): `tags.py` (raw OSM
tags by pyosmium), `graphfun.py`, `greatclass.py` (edges of `graph.bin`). Boxes: the roads inside the stated lon/lat box
(Asturias box -6.6..-4.0 / 42.9..43.6, Huesca box -1.0..1.0 / 42.0..42.9); a road is matched by exact `ref`, prefixes
for the lanes (`LLN-`, `PI-`, `CB-`, `CO-`, `HF`, `SC-222`).

## What the tags say (OSM, km by share)

| Group | km | highway | maxspeed tagged | lanes tagged / `lanes=1` | width tagged | `is_narrow` |
| --- | --- | --- | --- | --- | --- | --- |
| N-260 (t3 box) | 117 | trunk 116 | 42 % (40-60 km/h on 22 km) | 79 % / 14 % | 65 % | 12 % |
| N-621 Hermida | 42 | trunk | 23 % | 72 % / 1 % | 0 | 0 |
| AS-114 Panes-Cangas | 54 | primary | 21 % | 99 % / 1 % | 0 | 0 |
| N-110 Tornavacas-Jerte | 47 | trunk | 65 % (70-90 on 22 km, 40-50 on 6) | 100 % / 13 % | 0 | 0 |
| CV-800 Carrasqueta | 26 | secondary | 98 % (90) | 98 % / 13 % | 0 | 0 |
| LLN- (Asturias) | 73 | tertiary | 8 % | 17 % / 0 | 0 | 0 |
| PI- | 76 | tertiary | 6 % | 1 % / 1 % | 0 | 0 |
| CB- | 28 | tertiary | 0 | 0 | 0 | 0 |
| CO- | 32 | tertiary | 0 | 16 % / 0 | 1 % | 1 % |
| SC-222xx (Huesca) | 20 | tertiary 14.5, unclassified 4.9 | 0 | 1 % | 0 | 0 |
| HF (Huesca) | 172 | tertiary 102, unclassified 62, track 9 | 33 % (30-40 km/h on 58 km) | 22 % / 21 % | 6 % | 23 % |
| unnamed, no ref (tertiary/unclassified), Asturias box | 6,119 | unclassified 5,606 | 2 % | 4 % | 1 % | 3 % |
| same, Huesca box | 932 | unclassified 844 | 4 % | 5 % | 7 % | 5 % |

## What the model gives them (graph.bin of main)

| Group | km | fun per km | km at fun >= 0.8 | km at fun >= 0.92 | class | posted <= 40 km |
| --- | --- | --- | --- | --- | --- | --- |
| N-260 (t3 box) | 117 | 0.20 | 0.7 | 0.4 | trunk | 16.5 |
| N-621 Hermida | 42 | 0.43 | 3.2 | 0.1 | trunk | 6.2 |
| AS-114 | 54 | 0.33 | 0.1 | 0.1 | primary | 7.7 |
| N-110 Tornavacas-Jerte | 48 | 0.20 | 4.2 | 0.2 | trunk | 14.7 |
| CV-800 | 26 | 0.42 | 4.6 | 0.7 | secondary | 0 |
| LLN- | 73 | 0.68 | 28.1 | 6.5 | tertiary | 1.5 |
| PI- | 76 | 0.83 | 53.0 | 31.3 | tertiary | 4.6 |
| CB- | 28 | 0.95 | 25.3 | 22.9 | tertiary | 0 |
| CO- | 32 | 0.49 | 11.1 | 8.6 | tertiary | 0 |
| HF | 138 | 0.62 | 69.3 | 17.8 | tertiary 99, unclassified 39 | 57.6 (narrow 26 %) |
| SC-222xx | 20 | 0.74 | 5.8 | 4.0 | tertiary | 0 |
| unnamed Asturias | 5,545 | 0.24 | 268 | 170 | unclassified 5,054 | 79 |
| unnamed Huesca | 744 | 0.21 | 31 | 16 | unclassified 661 | 22 |

## What it means for the two signals (measured, not yet a result)

1. **The classics are all trunk, primary or secondary; the model gives them 0.20-0.43 fun per km and almost no km at
   0.8** (0.1 to 4.6 km of 26-117). The lanes are all tertiary with a ref, and the model gives them 0.5-0.95 (CB- 23 of 28
   km at 0.92). The ordering the expert objects to is in the numbers.
2. **A flow bonus has something to hold on to**: class (trunk, primary, secondary) plus the tags the classics carry
   (`lanes` tagged on 72-100 % of them, a posted 60-90). It would need to be large: a classic at 0.2-0.4 fun per km would
   have to double to pass the lanes, and the lanes are not lowered at all by it.
3. **A lane floor has nothing to hold on to for LLN-, PI-, CB-, CO-, SC-222**: they are tertiary, with a ref, and carry
   no `maxspeed`, `lanes`, `width` or `surface` more than Vidrà or Tost do; `is_narrow` is 0-1 % on all of them. The
   only separable group is HF (posted 30-40 km/h on a third, `lanes=1` 21 %, narrow 23 %), which `is_narrow` and the
   posted-limit chip already treat.
4. **A class floor on tertiary would hit the bench**: of the 28 great roads, 14 are tertiary or mostly tertiary (Vidrà,
   Mare de Déu del Mont, Tost, Santa Engràcia, JV-7032, CV-345 x2, CV-363, GIV-5221, BV-5114, CA-643, A-4132, CA-9104,
   C-462), several of them at 0.9-0.99 fun per km: the same class and the same missing tags as the council lanes.
   The maintainer's decision to keep the village lanes (2026-10-15) points the same way.
5. **Long unnamed stretches** are not overvalued in aggregate: unclassified at 0.24 fun per km (the pace factor), 3 % of
   them at 0.92. The expert's "km high" complaint is about the 170 km at 0.92 inside the 5,545 km of the Asturias box,
   a few per cent, not about the class as a whole.

So, before any fit: the classics side is testable with the tags the pipeline has; the lanes side is not, with tags. What
could still separate lanes from Vidrà/Tost is geometry or context (road length, traffic, the single-farm destination,
road width as drawn, village density), none of which the pipeline holds today. The held-out set that road-scout is
writing is the test of whether anything does.

## Proposal to the director

- Go on with the flow bonus (step 2 on the calibration set, class and posted-limit conditions only) and report the lanes
  as "no tag-based signal" unless the held-out set suggests one.
- Do not try a tertiary class floor: it costs the G1 roads above and the maintainer's village lanes.

## Step 2: the flow bonus on the calibration set (dev half only; the test half is not read)

Harness: `.claude/handoffs/routing-scripts/fit_flow_bonus.py` (git-ignored), same locate/score as `score_baseline.py`
(chains cache `chains_d1.pkl`, 60 of 81 dev stretches matched, the 21 missing are urban avenues and motorways). The
candidate multiplies the curve fun of a stretch whose class is trunk, primary or secondary by (1 + bonus), capped at 1,
inside a fun band. Baseline rank agreement (Spearman with the label): 0.469 over all 60; 0.535 over the 45 stretches
of those classes; 0.364 over the 15 tertiary.

| bonus, band | all | fast classes only | fun of labels <= 2 | concordance (labels 1.5 apart) |
| --- | --- | --- | --- | --- |
| none | 0.469 | 0.535 | 0.09 | 0.901 |
| +25 %, fun 0.3-0.9 | 0.427 (change -0.042, 95 % [-0.157, +0.098]) | 0.608 (+0.073, [-0.028, +0.226]) | 0.09 | 0.884 |
| +25 %, any fun | 0.380 (-0.089, [-0.205, +0.018]) | 0.574 (+0.039) | 0.11 | 0.844 |
| +50 %, any fun | 0.314 (-0.155, [-0.335, +0.006]) | 0.590 (+0.055) | 0.14 | 0.794 |
| +25 %, fun 0.4-0.8 | 0.382 | 0.502 | 0.09 | not run |
| +100 %, any fun | 0.255 | 0.583 | 0.18 | not run |

- **No candidate beats the baseline.** The best one lifts the fast classes by 0.07 inside an interval that holds zero, and
  lowers the overall agreement and the concordance. By the acceptance rule of the plan ("if no candidate beats the
  bootstrap interval, the answer is leave the curve as it is") this is "no change" on the calibration set.
- **Why, in the data:** the stretches of the fast classes are already high in the model (mean fun 0.45 trunk, 0.54 primary,
  0.75 secondary) and the labels spread within them; a multiplier lifts the ones labelled 3 as much as the ones labelled 4.
  The set also rates N-110 Jerte valley (`ext-jerte-valley`) 2.0 and Tornavacas (`ext-tornavacas`) 3.0, where the expert
  calls the road a classic: the set's label is the character of a 1.5-3 km stretch, not whether a road is worth a detour
  (the expert's "worth" is a different property). So the set cannot confirm or refute the expert's classics.
- Not tried, and why: a posted-limit condition (`maxspeed` is not in the chain cache; the survey shows the classics carry
  60-90 on 20-65 % of their km, so the condition would miss most of them), and a lane signal (step 1: no tag).
- Decision needed from the director: the held-out set (road-scout and expert-rider, `worth`) is the one yardstick that
  measures what the expert says. It can be read once. Proposed use: not to accept a change (the dev result says no
  change) but as a diagnostic, with the baseline and the pre-registered candidate (+25 %, fun 0.3-0.9, trunk/primary/
  secondary) scored side by side against both raters, so the report says whether the model ranks the classics and lanes
  as the raters do. Without that read the report ends here.

## Step 3 diagnostic: the held-out set, read once (2026-10-16)

Not an acceptance: step 2 already says "no change". `data/calibration/two-sided-holdout.json` (road-scout, `worth` 1-5) and
`two-sided-holdout-expert.json` (expert-rider, blind, shuffled, matched here by `ref`, unique for all 20) were read once,
with the baseline curve fun and the pre-registered candidate (+25 %, fun 0.3-0.9, trunk/primary/secondary) side by side.
Same locate/score as step 2 (`holdout_diag.py`, git-ignored; chains cache `chains_d1.pkl`, a stretch is matched when both
ends are within 25 m of one chain's vertices). The set is spent: a better candidate needs a fresh one from road-scout.

**Matched 16 of 20**: 7 classics, 9 lanes. Not matched (no chain within 25 m of both ends, and not at 100 m either; cause
not examined): C-38 Coll d'Ares, NA-718 Urbasa, CA-183 Alto Campoo (all classics) and TV-7044 Prades (a lane).

| Road | Group | Class | Scout | Expert | Fun, baseline | Fun, candidate |
| --- | --- | --- | --- | --- | --- | --- |
| MA-8302 Genal | lane | tertiary | 2 | 3 | 0.98 | 0.98 |
| CC-115 Gata | lane | tertiary | 2 | 3 | 0.95 | 0.95 |
| CA-883 Tama-Viñón | lane | tertiary | 1 | 2 | 0.95 | 0.95 |
| CL-2 Colunga | lane | tertiary | 2 | 2 | 0.95 | 0.95 |
| LE-5107 Paradaseca | lane | tertiary | 2 | 3 | 0.94 | 0.94 |
| CV-4290 Umán | lane | tertiary | 2 | 3 | 0.88 | 0.88 |
| AV-P-711 Arenas | lane | tertiary | 2 | 3 | 0.86 | 0.86 |
| LU-P-5001 Courel | lane | tertiary | 2 | 3 | 0.86 | 0.86 |
| HU-V-2021 Fago | lane | tertiary | 2 | 3 | 0.85 | 0.85 |
| M-637 Navafría | classic | secondary | 4 | 4 | 0.79 | 0.98 |
| CV-20 Montanejos | classic | primary | 5 | 4 | 0.71 | 0.89 |
| EX-118 Villuercas | classic | primary | 4 | 4 | 0.66 | 0.82 |
| AS-15 Ranadoiro | classic | primary | 4 | 5 | 0.53 | 0.67 |
| OU-536 Rodicio | classic | primary | 4 | 4 | 0.35 | 0.44 |
| N-111 Iregua | classic | trunk | 4 | 3 | 0.26 | 0.26 |
| A-367 Ronda-Ardales | classic | secondary | 4 | 4 | 0.16 | 0.16 |

Model against the raters (Spearman of `worth` with fun, n = 16 unless stated):

| | scout, baseline | scout, candidate | expert, baseline | expert, candidate |
| --- | --- | --- | --- | --- |
| all | -0.822 | -0.468 | -0.723 | -0.421 |
| classics only (7) | 0.408 | 0.408 | 0.267 | 0.267 |
| lanes only (9) | -0.274 | -0.274 | -0.311 | -0.311 |
| pairs whose worth differs by 1.5 or more, ordered as the rater does | 0 of 63 | 13 of 63 | 1 of 20 | 3 of 20 |

- **The model orders the held-out roads the wrong way round.** Mean fun: lanes 0.91, classics 0.50 (0.60 with the
  candidate). All nine lanes (0.85-0.98) sit above all seven classics (0.16-0.79); the best classic, Navafría, is below the
  worst lane. The two raters, who disagree little, both put every classic at 3-5 and every lane at 1-3.
- **The candidate helps and is nowhere near enough.** It raises the five classics it can touch by 0.09-0.19 and moves the
  agreement from -0.82 to -0.47 (scout) and -0.72 to -0.42 (expert); the lanes do not move, because it does not touch
  them. N-111 (0.26) and A-367 (0.16) are outside its band (below 0.3); they are the fast sweepers the curve already scores
  as nearly straight, and they stay at the bottom.
- **Where the raters disagree** (spearman between them 0.86, n = 16): the expert gives eight of the nine lanes one point
  more than the scout (3 against 2; CA-883 2 against 1; CL-2 equal); and for the classics N-111 4 against 3, AS-15 4
  against 5, CV-20 5 against 4. Neither rater puts a lane above a classic, except N-111 (expert 3) level with the lanes.
  Their disagreement is a point of scale, not of order; the gap between the groups is bigger than the gap between raters.
- **What it does and does not say:** the held-out classics are chosen as fast, wide, smooth roads and the lanes as
  narrow, slow, broken ones, and the model has only the curve and the pace of the class. Every held-out lane is `tertiary`
  with pace factor 1, so the pace factor does not lower them (it is 1 from tertiary up); the narrow flag is 0 on them, as in
  step 1. This confirms the expert's complaint on a set the model never saw, with the same two directions, and confirms
  that no tag the pipeline has separates the groups other than the class itself (lanes tertiary, classics
  primary/trunk/secondary), which also holds for the bench's great tertiary roads (Vidrà, Tost, CV-363...).
- **Not shown:** whether a signal built on context (road width as drawn, village density, traffic, surface roughness) would
  separate them; nothing in the pipeline measures those today.

Verdict for the plan: no change to the model from this work (steps 2 and 3). The finding the maintainer asked about is
real and larger than a tuning knob: on held-out roads, curve fun alone ranks narrow lanes above wide classics by a wide
margin, and the only usable discriminator in the data is class, which would cost the tertiary great roads. The next
decision is a product one (what "fun" should include: pace and width, not only the curve), not a fit. Branch parked.
