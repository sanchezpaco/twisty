# Quality over quantity in the ride score, and sweepers that keep their value

Date: 2026-10-16. Plan approved by the director, stacked on the detour cap (main 101600b for the code, the data of main
`4525f9aa27229e67`). The fresh held-out set (`speed-fun-holdout*.json`) was **not opened**; the blind expert A/B and the
road-scout pass were not run because no variant passed the guards. Everything below is measured on the bench (127 trips,
the Mac) from scratch dirs: no run touched `app/public/data` or `data/interim`. Scripts are git-ignored
(`.claude/handoffs/routing-scripts/`: `qscore.ts`, `sweepers.ts`, `dom_pts.ts`, `plan_pts.ts`, `hook_worker.py`).

## What was tried

A score is the sum of `edgeFunM` over a route (fun share x length). It drives dominance (Pareto), the slider stops, and
three candidate orders (`perTime`, the great list, the coverage order). The wiring (`score.ts`, branch `quality-score`)
makes the per-edge score `edgeFunM x q(f)`, `q` being `f^(p-1)` or a weight per band of the edge's fun share, with the
stop rule `minScoreGain` scaled by `q(0.8)`; p = 1 is today and reproduces the detour-cap run exactly.

## Result 1: plain quality weights fail

Baseline (p1) = detour cap: recall 61 of 110 on tuning, 8 of 22 on holdout, 0 G1 loss. Lane km = LLN-, PI-, CB-, CO-,
HF-, SC-222 and the lane refs of the spent held-out set, from the highlighted twisties of every stop.

| Variant | Tuning | Holdout | G1 losses | Lane km, all stops / default stops | Trips >= 5 km of lanes at default / any stop |
| --- | --- | --- | --- | --- | --- |
| p1 (today) | 61 | 8 | 0 | 1,179 / 77 | 5 / 13 |
| p1.5 | 58 | 8 | 3 | 1,309 / 53 | 4 / 14 |
| p2 | 55 | 8 | 6 | 1,214 / 46 | 3 / 14 |
| p3 | 56 | 7 | 8 | 931 / 89 | 5 / 12 |
| p4 | 58 | 7 | 8 | 917 / 72 | 4 / 12 |
| bands 0.5 / 0.5 / 0.7 / 1 (below 0.4, 0.4-0.6, 0.6-0.8, from 0.8) | 56 | 8 | 5 | 1,130 / 53 | 4 / 14 |
| bands 0.3 / 0.5 / 0.75 / 1 | 57 | 8 | 4 | 1,223 / 53 | 4 / 12 |
| bands 0.2 / 0.4 / 0.6 / 1 | 57 | 8 | 4 | 1,157 / 79 | 5 / 13 |

Every variant moves 114-124 of 127 trips (a global re-ranking) and loses recall and G1. The four leads (CV-70 Confrides
1 of 4 demanded found, N-502 1 of 7, GIV-5221 1 of 4, JV-7032 0 of 2) are the same as today in all of them. Re-scoring
the trip's routes and taking the frontier (before the slider's stop rules) shows why no weight is a lever on all four:
CV-70 and JV-7032 reach the frontier only from p = 3; N-502 (7.6 km) is on it at p = 1 only at +155 min and never at
p >= 1.5 (a short great road loses to long good ones); GIV-5221 has 1 route of 262 that rides it, so at no p is it a
scoring case but of route generation. Coverage by fun per minute with 5 roads (`p1cov`, `b1cov`, `p3cov`) changes 2 trips
at p = 1 and nothing else. Ripoll -> Olot keeps C-153 at 0.9 km in all of them: its last stop is the protected one, and
the Vidrà - Sant Privat ride that dominates the old C-153 ride sits earlier on the frontier.

## Result 2: family 2 alone (the sweepers' pre-step)

Edge fun = max(today's curve x pace, lateral load `a = kappa v^2` with a0 0.4, amax 3, p 0.7), `v` the class speed capped
by the posted limit; the same gates as today (no motorway, link, residential, urban; tracks at their weight). Applied
to the graph and to the overlay's twisties (class speed only there). Graph rebuilt into a scratch dir: same nodes and
edges, data hash `0ac296702446c0c0`; 98 pipeline tests pass. Experiment branch `fun-fam2-exp` (not landed).

| Guard | Today | Family 2 |
| --- | --- | --- |
| Recall tuning / holdout | 61 / 8 | 58 / 7 |
| G1 losses | 0 | **4**: ca-9104-palomas (a-397-ronda-san-pedro-ends), cv-345-alpuente-titaguas and cv-363-losilla-ademuz (cv-35-tuejar-titaguas-ends), vidra-sant-privat (regional-024) |
| Lane km, all stops / default | 1,179 / 77 | 1,221 / 63 |
| Settled nodes, mean | 1,351k | 1,351k |
| Twisties in the overlay | 5,425 | 6,298 (+16 %: +416 of rating 1, +275 of rating 2) |
| Km at rating 4 / 5 | 14,127 / 3,394 | 14,879 / 4,012 |
| Leads and Ripoll -> Olot | unchanged | unchanged |

Sweepers keep their value (graph fun share, and the stops that ride at least 80 % of the road; roads defined by ref and
a box, trips along each road's axis extended 15 km each side):

| Road | Fun share, today -> family 2 | Stops riding it, today -> family 2 |
| --- | --- | --- |
| N-111 Iregua | 0.250 -> 0.314 | +0, +20, +35, +93 min -> same |
| A-367 Ronda - Ardales | 0.137 -> 0.137 | +0, +6, +136 -> same |
| N-260 Cotefablo - Foradada | 0.305 -> 0.392 | best stop 43 % -> 72 % |
| N-621 Hermida | 0.466 -> 0.599 | none (best 71 %) -> +80 min, 100 % |
| AS-114 Panes - Cangas | 0.333 -> 0.342 | +30, +40 -> +22, +40 |
| N-110 Tornavacas - Jerte | 0.212 -> 0.243 | +0, +11 -> same |
| CV-800 Carrasqueta | 0.459 -> 0.471 | none (best 3 %) -> none (8 %) |

No drop. The four G1 losses are great tertiary roads. Measured causes: on Vidrà (regional-024) the routes that ride at
least 80 % of it go from 31 to 1 (the appetite routes bend to the classics) and the one left is off the frontier; on
CV-363 and CA-9104 the ride is still on the frontier (+34 to +38 and +57 min) and is lost in the slider's stop
thinning. Coverage by minute with 5 roads brings none back.

## Not done, and what it would take

- Quality weights on top of family 2: not run, family 2 alone is not clean on G1.
- Blind expert-rider A/B, road-scout pass, the fresh held-out set: no variant reached them.
- A thinning that keeps great roads that are on the frontier (the common cause of two of the four losses) is a separate plan.
