# Blind evaluation of routing v1

Date: 2026-10-16. Kit: `app/bench/eval/` (d50afce), frozen from tag `routing-v1-2026-10-16` and its data in
`data/routing-v1-2026-10-16/`. Judge: `expert-rider` (Opus), two independent rounds, round B in reverse order. Raw
answers and the scoring script: `data/eval/judge-v1/` (git-ignored). The judge read only the prompt and the two
dossiers, never the key.

## Pairs: our nearest stop (X or Y) against the route that rides the demanded road, at about the same cost

| list | round | ours | equal | forced |
|---|---|---|---|---|
| misses (62) | A | 43 | 1 | 18 |
| misses (62) | B | 39 | 7 | 16 |
| controls (20) | A | 7 | 3 | 10 |
| controls (20) | B | 8 | 5 | 7 |

Rounds agree on 50 of 62 misses (37 ours in both) and 15 of 20 controls. Controls: our stop rides the road too but
usually costs more (median 93 against 54 min), so "forced" there means "the cheaper ride of the same road".

**Misses lost in both rounds (13):** CA-643 Lunada on cross-011, cross-020, cross-039; CV-70 Confrides on cross-029 and
great-cv-70-confrides-ends; CA-9104 Palomas on great-a-397-ronda-san-pedro; A-4132 Alpujarra on its own trip; BV-5114
Santa Fe on great-bv-5301-montseny; N-502 Puerto del Pico on cross-003 and its -ends trip; C-462 Tuixent-la Seu on its
-ends trip and on great-n-260-port-del-canto-ends; CV-363 on great-cv-345-alpuente-titaguas-ends. So the list metric
(70 of 132 found) understates: on the misses our route is preferred about two times in three (69 % / 63 %), and 13 to
18 are real misses.

Correction: the first version of this table (and of `score.py`) counted every pick as ours on the 36 pairs whose X is
the forced route; found by the routing session, numbers above re-scored from the same raw answers. The v2 section was
scored with the right mapping.

## Absolute: 25 trips, default and most-fun stop, "would I ride this, for this trip?" 1-5

| | round A | round B |
|---|---|---|
| default stop, mean | 3.08 (2s: 7) | 2.96 (2s: 9) |
| most-fun stop, mean | 3.08 (2s: 5) | 3.16 (2s: 5) |

Same score in 34 of 50 items, one point apart in 15 and two points apart in 1.

## What the judge saw, both rounds unprompted

1. Out-and-back: the N-621 ridden to Potes and back to the A-8, the Gerri loop, a westward A-5 detour.
2. City centres: routes across central Madrid streets (María de Molina, José Abascal, M-30) and Burgos.
3. Small side loops off a good road that add minutes for nothing (La Vansa off the C-462, Son-Jou-Espot, Béjar
   villages, the HF04 lanes off the N-260).
4. Montseny paid for with 50-100 km of AP-7 where a direct Lluçanès, Collsacabra or Bracons line is better.
5. Long options add 2-3 h of village-dense lanes (Galicia, Omaña, Andévalo, Penedès) instead of nearby passes.
6. Wide flowing passes are undervalued by the fun score: Lunada, N-502 Puerto del Pico, N-621 Hermida, N-625 Beyos,
   Ma-10, A-4132.
7. "Unsafe km" flags famous narrow roads (Beget, C-462, A-1702, Vidrà): read as slow, not as dangerous.

## Decision (maintainer, 2026-10-16)

Order of work: (1) route defects 1-3, (2) the value of a road (5, 6, then 4 if it remains), judged by this kit rather
than by the great-roads list, (3) the orienteering planner (`plans/2026-10-16-orienteering-planner.md`) once the value
can be trusted, since it optimises the value harder. Every step is judged again with this kit against v1.

## v2: route defects steps 1-2 (main 7e2147b, same data)

Out-and-back removed (R1 46 stops -> 0); city cap not landed (two G1 losses, R16 did not move); dominated loops were
already zero. Our route changed in 9 of the 82 pairs and 7 of the 50 sample routes. Those were judged blind again (two
rounds, the same prompt) mixed with as many unchanged items as anchors, to measure the judge's drift.

- Changed pairs (ours/forced/equal per round, v1 -> v2): La Ragua a-337 OF -> OO, Lunada on p-78bb6ab8 F= -> OO,
  Montseny bv-5301 OO -> FO; the other six unchanged (Lunada twice and BV-5114 still lost). Net: one pair better.
- Anchor pairs: 9 of 9 answered as in v1 by both rounds, so the pair verdicts are stable.
- Sample, changed routes: mean 3.07 -> 3.36. Anchor routes (unchanged): 3.08 -> 3.31 on the 13 both rounds scored.
  The rise is the judge's drift, not the change: no measurable gain on the sample.
- One round-A answer is missing (s-9f934c4a). Raw answers and ids: `data/eval/judge-v2/`.

Reading: the fix removes a real defect from our routes, and nothing got worse; the judge's own out-and-back remarks
were about forced routes (N-621 to Potes and back). The quality left on the table is the value of a road (Next up 9).

## Flowing fun step 1: curve fun along the road (branch `flowing-fun` 463a6bc)

Curve fun taken along the way's chain instead of per OSM way (the window was clipped at way ends); gates stay per way.
The whole kit was judged blind again (two rounds, round B in reverse order) on the step 1 dossier
(`data/eval/flow-step1/`, 63 of 82 pairs and 36 of 49 sample routes changed against v2), scored against v1.

| Group (votes over two rounds) | ours v1 -> step 1 | forced v1 -> step 1 |
| --- | --- | --- |
| Misses that changed (47) | 64 -> 71 | 23 -> 19 |
| Misses unchanged (15, drift) | 18 -> 19 | 11 -> 10 |
| Controls that changed (16) | 10 -> 13 | 17 -> 15 |

- Lost in both rounds: misses 13 -> 12, controls 7 -> 6.
- Sample, mean of 1-5: changed routes 2.88 -> 2.97, unchanged 3.65 -> 3.69 (drift).
- Bench: G1 8 lost / 6 gained; twisty km 52 trips better, 1 worse on the tuning set. No lost road lost fun: every loss
  is a reshuffle between near-equal stops (BV-5301 for BV-5114, GI-664, A-366 for A-397, CV-350/355 for CV-345,
  CV-190 for A-1702, fewer stops kept on C-462 Coll de Port and CA-9104, Somiedo ridden 74 % under the 80 % bar).
  Gained: N-502 Puerto del Pico, C-462 Tuixent (two trips), CV-345, Vidrà, GIV-5221.
- Kit bug: the 4 added misses built from controls reuse their ids (p-e980fc03, p-ce0a4a8d, p-dca3bff5, p-90058803),
  so 90 items carry 86 ids; scoring keys on id and role.

Reading: a real defect fixed, modestly better per the judge, nothing worse. The maintainer accepted the G1 swap and
step 1 lands (2026-10-16); step 2 (speed-scaled heading change) is fitted on top of it.

## Flowing fun step 2: no change (maintainer, 2026-10-17)

Town crossings (E, branch `flowing-fun-2`): a built-up way with no fun no longer feeds its corners into the road around
it. Bench against main: G1 2 lost / 2 gained, both losses near-equal reshuffles (C-462 Tuixent-la Seu on
great-c-462-coll-de-port-ends, CV-345 Alpuente-Titaguas on great-cv-345-villar-alpuente-ends), accepted by the
maintainer; recall unchanged. E lands.

Step 2, each bend weighed at the speed the road is ridden at (k = 2, branch `flowing-fun-k2-exp` b7d26a2), failed the
bench and was not judged: G1 19 lost / 4 gained, recall 62 -> 48 of 110 on the tuning set. The lost tight roads keep
their fun; the nearest stop now rides a raised fast road near them instead (N-260 Olot-Ripoll for Vidrà, N-629 for
Lunada, C-26 and C-55 for C-462 Tuixent, A-374 for CA-9104). The limit is the stop rules: one appetite route per slot,
so a raised fast pass takes the slot of a tight road. The held-out set and the 25 fresh trips stay unspent. Details:
`plans/2026-10-16-flowing-fun.md`, section 3.
