# Candidates merged across junctions (measure only)

Question (ROADMAP, Phase 4b): do candidates that stop at a short zero-fun junction edge, or where the road changes name
along one ref, find more of the bench's great roads if they continue? Variant measured: `continuation` compares the ref
(the part of the label before ` · `) instead of the road id, everything else as in `findCandidates`. Main data
`4525f9aa27229e67`, scratch data dir with its own `candidates.bin`, bench as `make bench` would run it.

## Result: no change

| | today | ref merge |
| --- | --- | --- |
| candidates | 6,017 | 5,942 |
| km of candidates | 47,753 | 48,410 |
| recall, tuning | 58 of 110 | 57 of 110 |
| recall, holdout | 8 of 22 | 8 of 22 |
| great roads newly found | - | none |
| G1 | - | one loss: `c-462-tuixent-la-seu` on `great-c-462-coll-de-port` |
| settled nodes, mean / p95 | 1,305k / 5,474k | 1,306k / 5,474k |

12 of 127 trips change. Share of the road one candidate covers (bench great roads that moved): N-502 Pico 63 → 97 %,
GIV-5221 65 → 100 %, C-462 Tuixent-La Seu 36 → 97 %, A-337 La Ragua 73 → 96 %, N-621 Hermida 39 → 75 %, CV-70
Confrides 77 → 85 %, A-4132 38 → 54 %, BV-5301 95 → 96 %; the rest unchanged (CV-363 56 %, CV-345 Villar 48 %).

The N-502 (77 m) and GIV-5221 (128 m) splits of `2026-10-16-own-road-misses.md` are a changed street name along one ref
("N-502" and "N-502 · Carretera Ávila a Córdoba"), not a junction: a ref key joins them with no bridge over zero-fun
edges. A first run keyed an unnamed-suffix label by road id and showed 63 % and 65 % unchanged: that was a bug of the
variant, not a finding.

## Why the loss, measured (`great-c-462-coll-de-port`, Solsona → La Seu)

Today the C-462 stretch is two candidates: 13.9 km at 97 % fun (rating 5, great, great rank 9 of 172) and 13.6 km at
69 % (rating 3). The great one is ridden at stop 4 (+64 min) and that stop covers 100 % of the Tuixent road. With the
merge the whole road is one candidate of 63.5 km at 77 % fun (rating 3): it is no longer great, and the planner drops
it as "outside the cap by the straight-line bound". Stop 4 (+66 min) then covers 72 %.

A merge puts the great piece of a road into an average candidate; the planner rides and ranks a candidate whole.

## What would be needed

Merging only pays if a candidate can also be ridden by its best window (a sub-stretch with its own rating and entry
and exit), a change of `ride` and of the great-candidate rule, not of `findCandidates`. Nothing to build now: no great
road is newly found, and the own-road misses of the review are bound by the detour cap and by dominance, not by the
split. Worth measuring again once the detour cap decision lands, since the "outside the cap" part changes with it.
