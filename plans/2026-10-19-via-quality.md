# Plan: trips with stops, quality before they reach the maintainer (ROADMAP 16)

Status: for the director's approval, nothing built. Owner: routing. Date: 2026-10-19. From the expert-rider's read of
the via set (`make bench-via`, main d5c0306), findings 2 and 3; both must be fixed before stops reach the maintainer
(director, 2026-10-19). Measured on main's data with scratch scripts; the numbers below name their run.

## Item 2: the budget goes to filler, not to the leg with the best road

**What the rider sees.** On the loop València → Teruel → Segorbe → València the default option (+28 min) rides
A-2521, CV-2391 and CV-218 (4 km rated 4-5). The Calderona (CV-25, 25 km rated 4) on the last leg alone, +38, is
never offered; the slider rides it only at +156, together with CV-363.

**Cause (measured).**
1. CV-25 is the trip's best great road (18 great roads in reach; CV-25 25 km rated 4 is the first). The great-road
   term of the slider (`slider.ts`) pays a great road once, whichever stop rides it: the +156 option already rides
   CV-25, so a lower stop riding it earns nothing more. The slider forced CV-235 at +53 and CV-25 only at +156.
2. On its own leg, the CV-25 ride (+38, 23.4 fun km, 25 km rated 4) is not even on the leg's frontier: CV-218 + CV-310
   (+36, 25.1 fun km, 9 km rated 4) beats it, rating-2 metres counting almost as much in the fun score. That is
   finding 1 (the value model), not this item.
3. Joining each leg's great-road rides to the other legs' fastest ride (so "CV-25 alone" is among the slider's items)
   changes nothing: with and without the joins the loop's options are the same (via set, 20-minute joins with and
   without the frontier filter).

**Change.** The great-road term pays a road's fun **times the share of the slider's budgets that reach it**: `1 −
extra time of the first stop that rides it / range`. The objective's first term already counts a stop's value by the
share of budgets that land on it; a great road shown only at +156 reaches 13 % of riders' budgets, at +38 it reaches
79 %. `GREAT_ROAD_WEIGHT` is fitted again with the step-1 rule (most tuning recall without twisty km per budget falling
more than 2 % against main), since the term now weighs less.

**Measured with the change** (scratch experiment, `slider.ts` objective only):
- Via set, defaults: the loop's default becomes **CV-25 alone at +37** (26 km rated 4, no filler); A-1702 north end
  rides 54 km of A-1702 at +41 instead of 45 at +32; the three other trips keep their default. The loop's top option
  loses the CV-363 + CV-25 day (+156, 71 rated km; the best +143 has 17).
- Two-point bench, tuning only, against main: weight 0.09 is the fit (0.12 already loses 3 % of twisty km at
  45 minutes): recall 74 of 109 against 75, twisty km per budget within 0.6 %, **one G1 loss: CA-643 Lunada on
  cross-020**. Holdout not read.

**Built as:** the objective change and the refit; the G1 loss measured (which stop, which ladder) and taken to the
maintainer with the two rides if it remains; holdout read once; the loop's top-option loss checked against the reach
term (a stop at +156 still earns 13 % of a road's fun, so a second great road there should still pay).

**The alternative** is the same term on trips with stops only, which leaves two-point trips as they are. It is the
smaller risk, but the slider would then mean two things; I recommend the term for every trip, decided on the G1 cause.

## Item 3: a leg passes its own end, or comes back to its start

**What the rider sees.** Loop option 9: the leg Teruel → Segorbe rides the A-23 past Segorbe to Soneja, climbs the
Espadán and comes back down to Segorbe; the next leg leaves Segorbe for Soneja again. Jaca → Panticosa → Benasque
option 9: the first leg rides N-240, A-1603 to San Juan de la Peña and A-1205 back into Jaca before setting off.

**Measured** (a leg that comes within 3 km of its end and then goes more than 8 km from it, or goes more than 8 km from
its start and comes back within 3 km of it): on the via set 2 of 99 option legs (one passes its end by 16 km, one comes back within 0.4 km of its
start); on the two-point bench 11 of 1,028 options (6 at the finish, 5 at the start). The expert's third case
(València → Requena → Chelva to reach Titaguas) is a long way round, not this shape: it is finding 1.

**Change.** `ridesOfLeg` leaves out a ride that passes its leg's start or end: more than 8 km from the point, then within
3 km, then more than 8 km away again (the two distances named constants). Asking for the third step keeps a short trip
whose end lies near its start, which the measure above would flag; the numbers are taken again with it. It applies to two-point trips too, since it is the same function: a ride to B that passes B and comes
back is no more what a rider asks for than one through a stop.

**Should show:** 0 of the via set's legs and 0 of the bench's options pass their start or end; no G1 loss on the bench,
twisty km per budget within 2 %; the via set's other options unchanged or better (the expert reads the two trips).

## Checks for both

- Bench against main: D1, G1 (any loss to the maintainer with its measured cause), recall tuning and holdout, twisty km
  per budget; `make bench-via` with 0 failures; the baseline re-recorded on the branch.
- Expert-rider: the via set again, and the 25 fresh trips blind against main (item 2 changes two-point slider stops).
- Unit tests: a great road on a lower stop is worth more than the same road on a higher one; a leg ride that passes its
  end, or comes back to its start, is left out, and one that only ends near its start (a short trip) is kept.
- Mac timing of the loop and the three Huawei trips, alternating; the Huawei pass with the next tester APK.

## Cost

Item 3: half a day. Item 2: a day with the refit, the G1 cause and the expert read.

## Filed elsewhere (director, 2026-10-19)

- Finding 1 (options beaten by a cheaper one on rated km; lanes instead of a classic higher up) and the expert's long
  way round: the fun model item ("what fun should include beyond the curve").
- Finding 5 (road names "GR-238.7", a 14.6 km "unnamed road", "Camino San Antonio"): gis-data-engineer, with the
  unverified refs item.
- Finding 6 (near-duplicate options, Jaca options 1 and 2): minor.
- `MAX_VIA` stays 3.
