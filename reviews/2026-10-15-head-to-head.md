# Head-to-head with OsmAnd and Kurviger, six trips

Date: 2026-10-15. Plan: `plans/2026-10-15-head-to-head.md` (approved). Owner: `routing`. Judge: `expert-rider`, blind.

**Read this first: every time and every "extra minute" in this report is OUR graph's time, over OUR graph's fastest
route, for every route alike.** Google's, Kurviger's and OsmAnd's own ETAs are shown in one reference column and never
enter a score: their speed models differ (Kurviger assumes about 66 km/h on tight roads, our graph about 40), so reading
their ETAs next to our minutes would mislead. The anchor is our graph's fastest route, not Google's (Google has no GPX
export without an account).

## What was run

- **Twisty:** `Planner.plan()` on main 777440a with the landed data (stack-data-g) for the six trips: València → Los Santos
  de Maimona (t1), Madrid → Granada (t2), Jaca → Benasque (t3), Santander → Oviedo (t4), Madrid → Plasencia (t5), València →
  Alicante (t6). Two options per trip are reported: the default stop (the last within +45 min) and the most-fun stop.
  Others are used for the equal-cost comparison.
- **Kurviger 3.6.6 (app, on the Huawei):** Fast and curvy, Curvy, Extra curvy, each exported as GPX (Track included,
  no account, no purchase). Start and end typed as coordinates, the same ones as ours. 18 routes. Its curvature setting was
  "Curvy" and was left as "Curvy".
- **OsmAnd web planner (osmand.net/map, headless Chrome):** motorcycle profile, default and "No motorways", GPX download,
  12 routes. **Engine caveat:** this is OsmAnd's server-side routing, not the offline engine of the phone app, so a route
  can differ from what the OsmAnd app on a phone would plan. The app on the phone was not used: its free quota of map
  downloads covers 5 of the 6 trips and is the maintainer's.
- **Scoring:** every GPX is map-matched onto our graph (Viterbi over the edges within 35 m, gaps joined by the fastest
  path, and a break counted as a gap when our graph has no way through) and scored with the same code as our routes.
  Matched share 93.8 % to 100 %; the three routes under 97 % are t3 Kurviger curvy (94.7 %) and extra curvy (95.4 %) and
  t6 Kurviger extra curvy (93.8 %). Our own exported GPX, matched back, reproduces our routes (checked on 12: 99.8–100 %
  matched, fun km within ±1).
- **Metrics:** extra minutes (graph time); fun km (the graph's fun-weighted metres); fun per extra minute; km high = km
  whose surrounding 5 km hold a fun share ≥ 0.8 / ≥ 0.92 (no stretch merging involved); km on stretches the app would rate
  ≥ 4 (fragile: it depends on how runs merge across gaps ≤ 1 km); motorway/trunk km; unsafe km = tracks + posted ≤ 40 km/h
  + fords (the narrow flag is left out: it over-flags, see ROADMAP).
- **Blind judgment:** `expert-rider`, two rounds with the 7 routes of each trip relabelled and reordered, with roads and
  figures but no source. Round A and round B agree on the top pick of all six trips.

## Results, per trip

"Twisty default" is the default stop, "Twisty most-fun" the most-fun stop; the last column is the competitor's own
distance and time, for reference only.


### t1 València → Los Santos
| route | extra min | km | fun km | fun/min | km≥0.8 | km≥0.92 | km rating≥4 | motorway km | unsafe km | matched | their own km, time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fastest (graph) | 0 | 651 | 16 | – | 0 | 0 | 0 | 641 | 0.6 | – |  |
| Twisty default stop | 38 | 672 | 37 | 0.992 | 14 | 0 | 0 | 618 | 0.6 | – |  |
| Twisty most-fun stop | 174 | 717 | 126 | 0.727 | 22 | 10 | 0 | 502 | 0.9 | – |  |
| Kurviger fast and curvy | 191 | 678 | 76 | 0.398 | 28 | 6 | 0 | 159 | 2.0 | 0.998 | 675km, 9h 17min |
| Kurviger curvy | 295 | 727 | 97 | 0.329 | 49 | 6 | 39 | 14 | 5.6 | 0.996 | 723km, 10h 49min |
| Kurviger extra curvy | 933 | 1066 | 500 | 0.536 | 214 | 52 | 77 | 23 | 23.1 | 0.996 | 1059km, 17h 11min |
| OsmAnd web moto | 25 | 672 | 16 | 0.65 | 0 | 0 | 0 | 649 | 4.7 | 0.997 | 654.5 km, 06:31 |
| OsmAnd web moto, no motorways | 110 | 694 | 51 | 0.465 | 14 | 0 | 0 | 484 | 12.6 | 0.999 | 686.3 km, 09:00 |

### t2 Madrid → Granada
| route | extra min | km | fun km | fun/min | km≥0.8 | km≥0.92 | km rating≥4 | motorway km | unsafe km | matched | their own km, time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fastest (graph) | 0 | 418 | 0 | – | 0 | 0 | 0 | 410 | 1.3 | – |  |
| Twisty default stop | 42 | 438 | 28 | 0.675 | 16 | 0 | 0 | 376 | 1.8 | – |  |
| Twisty most-fun stop | 132 | 480 | 90 | 0.683 | 24 | 0 | 0 | 274 | 13.9 | – |  |
| Kurviger fast and curvy | 133 | 478 | 34 | 0.255 | 8 | 0 | 0 | 212 | 25.8 | 0.999 | 467km, 6h 24min |
| Kurviger curvy | 328 | 548 | 149 | 0.454 | 30 | 8 | 0 | 26 | 37.7 | 0.997 | 546km, 9h 2min |
| Kurviger extra curvy | 344 | 574 | 152 | 0.441 | 25 | 8 | 15 | 27 | 36.8 | 0.984 | 579km, 9h 39min |
| OsmAnd web moto | 24 | 442 | 0 | 0 | 0 | 0 | 0 | 423 | 3.0 | 0.999 | 424.4 km, 04:20 |
| OsmAnd web moto, no motorways | 131 | 516 | 32 | 0.246 | 0 | 0 | 0 | 363 | 19.1 | 0.999 | 512.4 km, 07:33 |

### t3 Jaca → Benasque
| route | extra min | km | fun km | fun/min | km≥0.8 | km≥0.92 | km rating≥4 | motorway km | unsafe km | matched | their own km, time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fastest (graph) | 0 | 132 | 16 | – | 0 | 0 | 0 | 105 | 18.1 | – |  |
| Twisty default stop | 38 | 149 | 39 | 1.019 | 4 | 0 | 9 | 96 | 25.7 | – |  |
| Twisty most-fun stop | 172 | 231 | 119 | 0.689 | 48 | 14 | 0 | 17 | 22.0 | – |  |
| Kurviger fast and curvy | 50 | 146 | 57 | 1.152 | 30 | 0 | 0 | 49 | 18.6 | 0.994 | 147km, 2h 27min |
| Kurviger curvy | 164 | 221 | 116 | 0.709 | 42 | 0 | 0 | 3 | 1.4 | 0.947 | 227km, 3h 30min |
| Kurviger extra curvy | 199 | 247 | 133 | 0.668 | 54 | 14 | 0 | 4 | 1.2 | 0.954 | 252km, 3h 47min |
| OsmAnd web moto | 2 | 132 | 16 | 9.944 | 0 | 0 | 0 | 103 | 18.2 | 0.992 | 132.2 km, 01:51 |
| OsmAnd web moto, no motorways | 13 | 138 | 19 | 1.439 | 0 | 0 | 0 | 102 | 18.4 | 0.993 | 137.3 km, 02:06 |

### t4 Santander → Oviedo
| route | extra min | km | fun km | fun/min | km≥0.8 | km≥0.92 | km rating≥4 | motorway km | unsafe km | matched | their own km, time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fastest (graph) | 0 | 192 | 0 | – | 0 | 0 | 0 | 186 | 0.8 | – |  |
| Twisty default stop | 32 | 201 | 20 | 0.607 | 16 | 10 | 22 | 171 | 0.8 | – |  |
| Twisty most-fun stop | 162 | 235 | 121 | 0.75 | 42 | 5 | 14 | 38 | 8.3 | – |  |
| Kurviger fast and curvy | 140 | 226 | 88 | 0.631 | 64 | 27 | 93 | 100 | 2.4 | 1 | 223km, 3h 9min |
| Kurviger curvy | 260 | 267 | 153 | 0.586 | 84 | 27 | 89 | 22 | 5.8 | 0.997 | 257km, 4h 42min |
| Kurviger extra curvy | 273 | 277 | 154 | 0.564 | 69 | 27 | 78 | 17 | 6.8 | 0.997 | 274km, 5h 6min |
| OsmAnd web moto | 19 | 209 | 0 | 0 | 0 | 0 | 0 | 191 | 4.0 | 0.998 | 193.4 km, 02:04 |
| OsmAnd web moto, no motorways | 60 | 205 | 40 | 0.675 | 0 | 0 | 0 | 103 | 13.7 | 0.998 | 203.6 km, 03:43 |

### t5 Madrid → Plasencia
| route | extra min | km | fun km | fun/min | km≥0.8 | km≥0.92 | km rating≥4 | motorway km | unsafe km | matched | their own km, time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fastest (graph) | 0 | 245 | 1 | – | 0 | 0 | 0 | 235 | 0.8 | – |  |
| Twisty default stop | 42 | 260 | 21 | 0.497 | 0 | 0 | 0 | 152 | 5.3 | – |  |
| Twisty most-fun stop | 164 | 306 | 102 | 0.622 | 18 | 0 | 0 | 60 | 12.1 | – |  |
| Kurviger fast and curvy | 48 | 264 | 16 | 0.323 | 0 | 0 | 0 | 146 | 1.0 | 0.994 | 261km, 3h 33min |
| Kurviger curvy | 164 | 309 | 96 | 0.585 | 0 | 0 | 0 | 12 | 29.7 | 0.993 | 303km, 5h 27min |
| Kurviger extra curvy | 164 | 323 | 93 | 0.568 | 0 | 0 | 0 | 12 | 14.8 | 0.995 | 317km, 5h 27min |
| OsmAnd web moto | 3 | 247 | 1 | 0.45 | 0 | 0 | 0 | 236 | 0.9 | 0.993 | 247.0 km, 02:34 |
| OsmAnd web moto, no motorways | 74 | 263 | 25 | 0.337 | 0 | 0 | 7 | 170 | 27.1 | 0.996 | 261.6 km, 04:23 |

### t6 València → Alicante
| route | extra min | km | fun km | fun/min | km≥0.8 | km≥0.92 | km rating≥4 | motorway km | unsafe km | matched | their own km, time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fastest (graph) | 0 | 162 | 0 | – | 0 | 0 | 0 | 138 | 0.5 | – |  |
| Twisty default stop | 32 | 165 | 26 | 0.799 | 8 | 0 | 0 | 88 | 2.7 | – |  |
| Twisty most-fun stop | 159 | 217 | 103 | 0.649 | 59 | 19 | 0 | 36 | 2.9 | – |  |
| Kurviger fast and curvy | 66 | 184 | 35 | 0.531 | 0 | 0 | 5 | 68 | 1.5 | 0.99 | 171km, 2h 31min |
| Kurviger curvy | 110 | 186 | 60 | 0.549 | 31 | 7 | 47 | 2 | 9.0 | 0.99 | 184km, 3h 17min |
| Kurviger extra curvy | 138 | 198 | 73 | 0.526 | 25 | 14 | 16 | 1 | 8.5 | 0.938 | 203km, 3h 57min |
| OsmAnd web moto | 20 | 188 | 0 | 0.016 | 0 | 0 | 0 | 160 | 1.4 | 0.989 | 177.0 km, 01:55 |
| OsmAnd web moto, no motorways | 66 | 202 | 14 | 0.206 | 0 | 0 | 0 | 109 | 7.0 | 0.993 | 192.8 km, 03:19 |



### Equal-cost comparison (our best option within their extra minutes; capped = their extra is beyond our 3 h slider)
| trip | competitor | their extra | their fun km | their fun/min | their km≥0.8 | our extra | our fun km | our fun/min | our km≥0.8 | beyond our cap |
|---|---|---|---|---|---|---|---|---|---|---|
| t1 | Kurviger fast and curvy | 191 | 76 | 0.398 | 28 | 174 | 126 | 0.727 | 22 | yes |
| t1 | Kurviger curvy | 295 | 97 | 0.329 | 49 | 174 | 126 | 0.727 | 22 | yes |
| t1 | Kurviger extra curvy | 933 | 500 | 0.536 | 214 | 174 | 126 | 0.727 | 22 | yes |
| t1 | OsmAnd web moto | 25 | 16 | 0.65 | 0 | 11 | 21 | 1.93 | 0 |  |
| t1 | OsmAnd web moto, no motorways | 110 | 51 | 0.465 | 14 | 84 | 69 | 0.826 | 14 |  |
| t2 | Kurviger fast and curvy | 133 | 34 | 0.255 | 8 | 132 | 90 | 0.683 | 24 | yes |
| t2 | Kurviger curvy | 328 | 149 | 0.454 | 30 | 132 | 90 | 0.683 | 24 | yes |
| t2 | Kurviger extra curvy | 344 | 152 | 0.441 | 25 | 132 | 90 | 0.683 | 24 | yes |
| t2 | OsmAnd web moto | 24 | 0 | 0 | 0 | 22 | 19 | 0.85 | 0 |  |
| t2 | OsmAnd web moto, no motorways | 131 | 32 | 0.246 | 0 | 108 | 73 | 0.675 | 16 |  |
| t3 | Kurviger fast and curvy | 50 | 57 | 1.152 | 30 | 45 | 46 | 1.01 | 30 |  |
| t3 | Kurviger curvy | 164 | 116 | 0.709 | 42 | 124 | 95 | 0.769 | 55 |  |
| t3 | Kurviger extra curvy | 199 | 133 | 0.668 | 54 | 172 | 119 | 0.689 | 48 | yes |
| t3 | OsmAnd web moto | 2 | 16 | 9.944 | 0 | 0 | 16 | None | 0 |  |
| t3 | OsmAnd web moto, no motorways | 13 | 19 | 1.439 | 0 | 0 | 16 | None | 0 |  |
| t4 | Kurviger fast and curvy | 140 | 88 | 0.631 | 64 | 108 | 89 | 0.82 | 22 |  |
| t4 | Kurviger curvy | 260 | 153 | 0.586 | 84 | 162 | 121 | 0.75 | 42 | yes |
| t4 | Kurviger extra curvy | 273 | 154 | 0.564 | 69 | 162 | 121 | 0.75 | 42 | yes |
| t4 | OsmAnd web moto | 19 | 0 | 0 | 0 | 19 | 13 | 0.707 | 0 |  |
| t4 | OsmAnd web moto, no motorways | 60 | 40 | 0.675 | 0 | 55 | 45 | 0.815 | 5 |  |
| t5 | Kurviger fast and curvy | 48 | 16 | 0.323 | 0 | 42 | 21 | 0.497 | 0 |  |
| t5 | Kurviger curvy | 164 | 96 | 0.585 | 0 | 152 | 89 | 0.583 | 0 |  |
| t5 | Kurviger extra curvy | 164 | 93 | 0.568 | 0 | 164 | 102 | 0.622 | 18 | yes |
| t5 | OsmAnd web moto | 3 | 1 | 0.45 | 0 | 0 | 1 | None | 0 |  |
| t5 | OsmAnd web moto, no motorways | 74 | 25 | 0.337 | 0 | 69 | 40 | 0.584 | 0 |  |
| t6 | Kurviger fast and curvy | 66 | 35 | 0.531 | 0 | 56 | 44 | 0.799 | 32 |  |
| t6 | Kurviger curvy | 110 | 60 | 0.549 | 31 | 69 | 54 | 0.776 | 32 |  |
| t6 | Kurviger extra curvy | 138 | 73 | 0.526 | 25 | 131 | 87 | 0.666 | 56 |  |
| t6 | OsmAnd web moto | 20 | 0 | 0.016 | 0 | 16 | 14 | 0.884 | 0 |  |
| t6 | OsmAnd web moto, no motorways | 66 | 14 | 0.206 | 0 | 56 | 44 | 0.799 | 32 |  |


## Blind judgment (expert-rider, two rounds, order and labels changed between them)

Ranked 1 = would ride. Mean rank over the six trips and both rounds: **Twisty most-fun 1.6**, Twisty default 3.4,
Kurviger fast and curvy 4.1, OsmAnd no motorways 4.3, Kurviger curvy 4.7, Kurviger extra curvy 4.9, OsmAnd default 5.1.

| trip | top pick, round A | top pick, round B | rank agreement between rounds (Spearman) |
| --- | --- | --- | --- |
| t1 València → Los Santos | Twisty most-fun (+174) | same | 0.89 |
| t2 Madrid → Granada | Twisty most-fun (+132) | same | 0.96 |
| t3 Jaca → Benasque | Kurviger fast and curvy (+50) | same | 0.86 |
| t4 Santander → Oviedo | OsmAnd no motorways (+60) | same | 0.61 |
| t5 Madrid → Plasencia | Twisty most-fun (+164) | same | 0.82 |
| t6 València → Alicante | Twisty most-fun (+159) | same | 0.96 |

What the expert said, as his words and not a measurement:
- Our most-fun stop wins four trips; "the dull parts are on the motorway" and the fun is on real roads (N-322 and the
  Sierra Morena roads on t1; Despeñaperros old N-4A and Sierra Mágina on t2; south Gredos and La Vera on t5; the Alicante
  mountain roads on t6).
- **Where he preferred another route:** t3, Kurviger fast and curvy swaps the Cotefablo stretch for the A-1604
  Lanave–Boltaña (+50 min); t4, the OsmAnd no-motorways route is "the classic": A-8, CA-131, the N-621 through the Hermida
  gorge, the AS-114 Panes–Cangas de Onís, N-634. He says the model gives the Hermida and the AS-114 almost no high-fun
  km (0 km high on the t4 route) and that this is wrong.
- **Where he disagrees with the fun model:** it undervalues fast flowing classics (N-260 Cotefablo and Foradada, N-621
  Hermida, AS-114, N-110 Tornavacas–Jerte, CV-800 Carrasqueta) and overvalues council lanes: LLN-, PI-, CB-, CO- in
  Asturias, SC-222xx and HF in Huesca, and long stretches of unnamed road, which count as "km high" but which he would
  not send a rider down. The slow-signed km (20–38 km on long routes) are where he looks first.
- **Our default stop on Jaca → Benasque was his bottom pick in both rounds:** it stays on the N-260 and adds council
  lanes (SC-22221-03, SC-22109-01, SC-22907-01, HF04) with 26 km signed at 40 km/h or less, "for almost nothing".
- Kurviger's curvy and extra curvy routes spend their extra hours on flat secondary roads out of Madrid and València
  (only 26 to 27 km of motorway on Madrid → Granada) and add 37–38 slow-signed km; extra curvy on t1 is 933 min, 1066 km:
  "nobody rides that as one trip".
- OsmAnd's default motorcycle route is the fastest route: "nothing to ride".
- Doubts he raised and that I have not checked: "PENVA" (t1) is not a road reference he knows; the ref "Pl-11" next to
  "PI-11" on t4 may be a typo in the data; two refs with "GR 48" on t2 may be the hiking trail sharing a road; "HF"
  roads on t3 may be forest tracks; the unnamed road stretches (up to 76 km on t1 extra curvy) need a surface check.
  These are open, not findings.

## Where they beat us, and why (each cause from a measurement)

At equal extra time (our best option within their extra minutes), our fun per extra minute is higher than or equal to the
competitor's in 25 of the 27 comparisons where both exist (exceptions: Jaca → Benasque against Kurviger fast and curvy,
1.15 against 1.01, and Madrid → Plasencia against Kurviger curvy, 0.585 against 0.583, a tie). By km of high-fun windows
the competitor leads on Santander → Oviedo and Jaca → Benasque, and those are the trips where the blind expert did not pick
us. Comparisons that are not like for like: Kurviger's curvy modes often cost more than our 3 h cap, where we have nothing
to offer (marked "beyond our cap" in the table above).

| trip | their route | their extra | their fun km | their km high | our best within that time | what is measured |
| --- | --- | --- | --- | --- | --- | --- |
| t3 | Kurviger fast and curvy | +50 | 57 (1.15/min) | 30 | +45: 46 fun km (1.01/min), 30 km high | close; Kurviger +11 fun km for 5 more minutes; its extra over ours is the A-1604 Lanave–Boltaña swap |
| t4 | Kurviger fast and curvy | +140 | 88 | 64 | +108: 89 fun km, 22 km high | same fun km, 3x the km of high-fun windows (64 vs 22): LLN-7 14 km, AS-340 10 km, LLN-14 9 km, AS-334 7 km, CO-3 7 km, all of them in our candidates and none ridden by any of our options |
| t4 | Kurviger curvy | +260 | 153 | 84 | beyond our cap; our most-fun +162: 121 fun km, 42 km high | AS-343 Puertas–Panes 23 km (fun 20), LLN-7, AS-340; all in our candidates |

Findings, in order of how much they matter for the product:

1. **The planner does not ride roads that are in its candidates.** On t4, the roads Kurviger rides that none of our
   options rides are in our candidate list: 14.06 of 14.06 km of LLN-7, 10.19 of 10.19 of AS-340, 23.23 of 23.23 of AS-343.
   So it is not a recall gap of the candidate search; it is selection, the cost cap, or the fun model's own scale. The
   expert's view is that most of these are council lanes he would not ride, so the model's overvaluing of them is also
   what keeps the planner busy with them. The first step is to measure, on t4, the detour our planner would need to
   ride AS-343 and LLN-7 and where they rank among the 40 candidates and the 20 great ones of that trip.
2. **The fun model gives flowing classics too little and council lanes too much** (blind expert, four examples above).
   This is the ROADMAP item "new fun signal for mixed roads": this study is more evidence, and it adds a second direction,
   the lanes. The expert's example for the lanes is measured in our own numbers: on t3 our default stop rides 26 km of
   slow-signed edges against 18 on the fastest route.
3. **Roads in competitors' routes that our candidates lack entirely: 188.6 km summed over the 30 routes** (curvy edges
   in no candidate, roads of 1 km or more). They are short fragments, not whole roads, because a candidate needs a curvy
   run of 3 km or more: the largest are an unnamed road of 8.8 km (t2), N-332 Cartagena–Valencia 7.4 km (t6), AS-114
   Cangas–Panes 5.8 km (t4), an unnamed 5.1 km (t5), CV-8151 Castalla 4.3 km (t6), JA-3200 Jaén–La Guardia 4.2 km (t1),
   N-634 4.2 km + 4.0 km (t4), CV-425 3.7 km (t1), CA-131 3.5 km (t4). Candidates miss the pieces of a good road cut by a
   village, a junction or a gap above 1 km.
4. **Roads they ride curvy that none of our options rides** (km): t1 A-3075 48, SE-179 43, JF-7038 35, CM-3263 23, PENVA
   19, CV-435 16; t2 CR-5041 30, A-6050 27, CR-500 27, A-6178 20, A-6177 17; t4 AS-343 23, LLN-7 14; t5 TO-1375 15. Most
   come from routes beyond our 3 h cap; the full list per route is in the scored files.
5. **Kurviger's extra curvy and curvy routes are far outside our slider** (t1 +933 and +295, t2 +344 and +328, t4 +273
   and +260 minutes, against our 3 h cap), and spend their time on flat secondary roads: motorway/trunk km 1 to 27 on all
   six trips (curvy and extra curvy), against 36 to 502 for our most-fun stops (36 on t6, 38 on t4, 60 on t5, 274 on t2, 502 on t1). At their cost they find roads we do not offer (item 4); at our
   cost they do not beat us (equal-cost table below).
6. **OsmAnd's motorcycle routes are poor curve finders:** the default route is the fastest one (0 to 16 fun km, 0 km high
   on all six trips); with "No motorways" it costs +13 to +131 min and gets 14 to 51 fun km, less than our best option of
   the same cost on t1, t2, t5, t6 (69, 73, 40, 44) and equal on t4 (40 vs 45); on t3 it is a little above ours at +13 min (19 fun km against 16); the expert nonetheless picked it for t4 because of the Hermida and the AS-114.
7. **Safety:** Kurviger curvy and extra curvy ride 37.7 and 36.8 km of edges signed at 40 km/h or less on t2 and 29.7 km
   on t5; OsmAnd no motorways 27.1 km on t5 and 19.1 km on t2; our most-fun stops 13.9 (t2) and 12.1 (t5). No route
   rode a track in this run.

### Graph connectivity: the La Roda junction and 28 more places (a finding of its own)

Matching exposed places where a competitor's route passes and **our graph has no way through**: 50 gaps in 29 distinct
places over the 30 routes; 15 of them (9 places) have a chord under 500 m and a path of more than 5 km in our graph.
- **La Roda, N-301 / CM-3117 / AB-705 (-2.325, 39.275):** chord 194 m, our shortest path 32.3 km. Measured in OSM: the
  AB-705 ends at (-2.3272, 39.2747) at a node shared only with residential streets (Calle Roldán and a 2-point
  residential way), which lead to the CM-3117 roundabout. The pipeline keeps a residential way only when one short way
  (600 m or less) runs directly between a dead end of a road and a node of the network (`connectors.py`,
  `joins_a_dead_end`); here two chained streets (about 190 m + 135 m) are needed, so AB-705 stays a dead-end stub and
  reaching it costs 32 km. Same road, same city, in 2 routes (Kurviger curvy and fast and curvy).
- Three more examined in OSM: Camí de l'Orxa a la Vall de Gallinera (chord 25 m, path 31.6 km), whose link to the CV-714
  is a `highway=path` (Camí Real) that our graph rightly does not route; Camí de la Llacuna (Gandia road, chord 447 m,
  path 61.2 km) and the Puente de la Lana in Sabiñánigo (chord 200 m, path 12.3 km), both reached through residential
  streets of a town.
- Not all 29 places are examined; many are inside València, where a router crosses residential streets. The rural ones
  with a small chord are the ones to count next.


## ROADMAP items proposed (the director owns the file)

1. **Connectors that chain two or more residential streets** (`connectors.py`): keep a path of residential ways up to
   600 m in total between a labelled road's dead end and the network; measure first how many labelled dead ends
   (about 76,500 degree-1 nodes in the graph, of which a share are real dead ends) become reachable, and that the graph
   grows by at most the budget. La Roda AB-705 is the test case (32 km to 0.3 km).
2. **Planner: roads in the candidates that no option rides**: on Santander → Oviedo, 14 + 10 + 23 km of LLN-7, AS-340 and
   AS-343 are candidates and unridden; measure rank, detour and cost cap on that trip. Put with the fun-signal item,
   since the expert says the same lanes are overvalued.
3. **Fun model, two-sided evidence for "new fun signal for mixed roads"**: classics undervalued (N-260 Cotefablo and
   Foradada, N-621 Hermida, AS-114, N-110 Tornavacas–Jerte, CV-800) and council lanes overvalued (LLN-, PI-, CB-, CO-,
   SC-222xx, HF, unnamed stretches). Candidate signals to measure on the calibration set: a width or a class floor for a
   lane, a bonus for flow on trunk/primary.
4. **Candidates: fragments**: 188.6 km of curvy edges in competitor routes sit in no candidate because the curvy run is
   under 3 km; test merging runs across a village or a short gap.
5. **Default stop that rides slow lanes** (Jaca → Benasque: 26 km of edges signed ≤ 40 km/h and four council lanes for
   +38 min): the default stop should not trade slow-signed km for nothing.
6. **Competitor study, re-run**: after the fixes, rerun this study (scripts in `data/head-to-head/`, git-ignored); add
   OsmAnd's offline engine if the maintainer allows the quota.

## What was not done

- OsmAnd's phone app (offline engine) was not used; the web planner stands in for it (server-side routing).
- Google's route was not scored (no GPX export without an account); Google's ETA was not recorded.
- The blind round covers Twisty's default and most-fun stops, not the equal-cost option, which is a different stop per
  competitor; the equal-cost numbers are in the table above and come from the scoring only.
- No cause above is attributed to the planner's internals except where a measurement is named; items 1 and 2 of the
  findings say what to measure next.

## Reproducing

Scripts and outputs (git-ignored): `data/head-to-head/` (harness `h2h.ts`, scored routes) and the session scratchpad
(`kv.py` and `kv_run.py` drive Kurviger through uiautomator; `osmand_batch.mjs` drives the OsmAnd web planner; blind cards
and key under `h2h/cards/`).
