# Plan: the value of a road, judged blind (ROADMAP Next up 9)

Status: frame approved by the director (2026-10-16) with three changes, folded in below: local relief only (no
absolute elevation) and a floor on the relief factor; an out-of-sample set of 25 fresh trips in the bar; the held-out
set may be opened once, at step 4. The DEM passed the data-policy review with conditions
(`reviews/2026-10-16-dem-data-policy.md`). Nothing fitted, no code. Owner: `routing`. Date: 2026-10-16. Brief:
`.claude/handoffs/brief-routing-value.md`. Evidence: `reviews/2026-10-16-blind-eval-v1.md` (with the pair numbers
re-scored in 4fe6de6).

Everything below is measured on the v1 data (`data/routing-v1-2026-10-16/`, identical to main's: `graph.bin` sha256
`4d4ec618080a`), with the planner of main (a807fe3: v2 of the kit, out-and-back fixed). The kit's 70 frozen trips were
planned again and checked against the v2 dossier (0 of 132 items differ in extra minutes). Scratch only; scripts in
`.claude/handoffs/routing-scripts/` (`kit_scan.ts`, `value_pieces.py`, `value_relief.py`, `value_points.py`,
`value_separate.py`, `value_tables.py`), outputs in the session scratchpad (`value/`).

## 1. What the judge's misses lose to

On the 13 misses lost in both v1 rounds (corrected numbers: CA-643 Lunada x3, N-502 Pico x2, CV-70 Confrides x2,
C-462 Tuixent x2, CA-9104 Palomas, A-4132, BV-5114, CV-363), **our route has more fun km than the forced route in 9 of
13** (median ratio ours/forced 1.12; 1.45 on the 38 misses won in both rounds). The demanded roads are not low-fun in
the graph:

| road | class | km | fun share | km at >= 0.8 (share) | km/h | max elev. m | climb m/km | hamlets /10 km |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CA-643 Lunada | tertiary | 14 | 0.76 | 0.67 | 40 | 1,359 | 114 | 0.7 |
| CA-9104 Palomas | tertiary | 13 | 0.91 | 1.00 | 34 | 1,196 | 103 | 0 |
| CV-70 Confrides | primary | 23 | 0.78 | 0.63 | 38 | 979 | 51 | 0.4 |
| A-4132 Alpujarra | tertiary | 34 | 0.69 | 0.26 | 40 | 1,545 | 95 | 0.6 |
| BV-5114 Santa Fe | tertiary | 22 | 0.87 | 0.63 | 34 | 1,333 | 88 | 0.5 |
| N-502 Puerto del Pico | trunk | 8 | 0.57 | 0 | 46 | 1,399 | 118 | 0 |
| N-621 Hermida | trunk | 28 | 0.46 | 0.07 | 53 | 322 | 61 | 3.6 |
| N-625 Beyos-Pontón | trunk | 40 | 0.75 | 0.54 | 40 | 1,318 | 76 | 3.8 |
| Ma-10 Tramuntana | secondary / tertiary | 110 | 0.67 | 0.33 | 41 | 739 | 79 | 0.1 |
| *Vidrà, Tost, CV-363, JV-7032 (guards)* | tertiary | 9-33 | 0.87-1.00 | 0.80-1.00 | 23-36 | 1,025-1,368 | 74-98 | 0-2.1 |

The value of a road today is fun share x length, where fun share = the curve value of its heading change per km times
`pace_factor(class)`, which is 1 for every class from tertiary up (0.25 for unclassified); the candidate rating is a band
of the same share, so it adds nothing. So the wide passes keep 0.5-0.9 and **lose because something the model scores
higher sits at the same cost**: village lanes and side loops at 0.65-0.8. Raising the passes alone would not fix it (the
two-sided and speed-aware work tried that: a flow bonus lifted the classics and left the lanes above them). **The lever
is lowering the lanes the judge does not want, without lowering the tight great roads (Vidrà, Tost, CV-363), which
the same model, the same class and the same tags cannot tell apart** (`reviews/2026-10-16-two-sided-survey.md`,
`reviews/2026-10-16-speed-aware-fun-step1.md`).

Two smaller findings: the card's "km at 0.8" is near zero on the wide passes (N-502 0, N-621 0.07), which is what the
judge read as "undervalued fun km"; and N-502 is only 8 km at fun 0.57, so 12 minutes of detour buys little score.

## 2. Labels used for the diagnosis

Road pieces (a run of one road name, at least 1 km), deduplicated by name and length:

- **Good** (398 pieces, 3,800 km): the 28 bench great roads and the Ma-10, whole, from the graph; plus every piece of a
  kit route whose ref the judge named as the reason a route was good (62 refs and the Vidrà road, read from the 459 lines of v1 and v2
  answers; mixed verdicts such as GIV-5221 Beget, A-348, CV-345 are in neither list). Split by class: 92 lane class
  (tertiary, unclassified), 306 wide class.
- **Lanes** (369 pieces, 2,050 km): (a) in the 26 kit items where the judge said our route spent its time on village
  lanes, side loops or tiny links, the lane-class pieces of our route that are off the fastest route, have fun share
  0.3 or more and are not a good road (236); (b) the lane pieces inside the R17b low-return side loops of main's bench
  stops (133).

The lists are in `value_pieces.py`; the reading of the judge's text is mine and is the weakest link (section 4).

## 3. Which signals separate them (measured, nothing fitted)

AUC = chance that a random good piece scores above a random lane piece (0.5: no separation). New signals, per piece:
junctions with other graph roads per km; edges per km; places within 300 m (hamlets, villages, towns) per 10 km; posted
40 or less and narrow, share of length; travel speed; **relief from the AWS Terrarium DEM** (z10, the tiles the app's
hillshade uses: maximum elevation, range, climb per km summed up and down at 50 m steps); **side ways meeting the
road** (OSM service, track, residential, living_street way ends within 15 m, per km); **buildings** within 100 m per km
(5.6 M OSM buildings).

| signal | good, lane class | good, wide class | lanes, judge items | lanes, side loops | AUC good lane class vs lanes |
| --- | --- | --- | --- | --- | --- |
| fun share (today's value) | 0.78 | 0.31 | 0.69 | 0.72 | 0.60 |
| piece km | 8.5 | 4.5 | 3.8 | 4.6 | 0.66 |
| junctions per km | 0.23 | 0.67 | 0.45 | 0.22 | 0.43 |
| hamlets per 10 km | 0 | 0 | 1.7 | 0 | 0.39 (fewer is better: 0.61) |
| villages, towns per 10 km | 0 | 0 | 0 | 0 | 0.55, 0.50 |
| posted <= 40, narrow (share) | 0 | 0 | 0 | 0 | 0.52, 0.52 |
| travel km/h | 39 | 63 | 46 | 41 | 0.35 |
| max elevation m (not used, see 1 below) | 1,037 | 733 | 477 | 667 | 0.79 |
| **elevation range m** | 280 | 103 | 108 | 131 | **0.73** |
| **climb m per km** | 74 | 44 | 37 | 43 | **0.73** |
| side ways per km | 1.1 | 1.2 | 1.5 | 1.1 | 0.47 |
| buildings per km | 1.8 | 2.0 | 0.9 | 1.5 | 0.55 |

(Medians. The wide-class good pieces include long straight runs of N roads in our routes, which is why their fun is
0.31; the AUC that matters is the lane-class one, where the tags fail.)

By area, km-weighted (lanes of the judge items):

| lanes | km | fun | climb m/km | hamlets /10 km | buildings /km |
| --- | --- | --- | --- | --- | --- |
| Galicia, Pontevedra parishes | 185 | 0.72 | 45 | 11.3 | 3.1 |
| Galicia, Costa da Morte | 56 | 0.56 | 41 | 9.5 | 8.1 |
| Asturias / Cantabria village lanes | 150 | 0.76 | 47 | 9.2 | 22.8 |
| Omaña / Órbigo | 91 | 0.71 | 51 | 6.1 | 0.8 |
| Andévalo / Sierra Norte | 214 | 0.66 | 32 | 0.3 | 0.3 |
| Segarra / Penedès | 110 | 0.67 | 38 | 1.0 | 3.3 |
| Jaén olive lanes | 97 | 0.67 | 40 | 0.1 | 0.2 |
| Algar / Serranía de Ronda lanes | 84 | 0.49 | 36 | 0.1 | 0.6 |
| Lluçanès / Moià, Espadán / Pina, Béjar | 140 | 0.55-0.65 | 33-38 | 0.2-1.3 | 1.3-7.1 |
| Vallès, Gallifa / Granera | 38 | 0.79 | 54 | 0.5 | 5.6 |
| La Vansa / Gargallà / Espot | 94 | 0.72 | 70 | 1.0 | 3.1 |
| Sobrarbe HF / SC lanes | 29 | 0.79 | 64 | 1.7 | 4.4 |
| side loops (R17b), lane pieces | 821 | 0.72 | 55 | 1.1 | 5.0 |
| *good roads above (section 1)* | | 0.46-1.00 | 51-118 | 0-5.4 | 0-28 |

What it says:

1. **Local relief is the one signal that separates**: climb per km and elevation range along the road (0.73 each). It
   separates the lowland and rolling lanes (Andévalo, Penedès, Jaén, Algar, Lluçanès: 32-41 m/km against 65-118 on the
   great roads), and it agrees with the judge's own words ("instead of the known passes nearby"). Maximum elevation
   separates a little more (0.79) and is **not used** (director): it is a regional proxy that would not travel to another
   country and would punish coastal classics.
2. **Hamlet density separates the parish lanes** (Galicia 9.5-11.3, Asturias 9.2, Omaña 6.1 per 10 km against 0-2 on
   most great roads), which relief alone does not (41-51 m/km). But Somiedo (5.4), Beyos (3.8) and Hermida (3.6) are
   classics with hamlets too: a hamlet term must only start above about 6 per 10 km, or it costs them.
3. **Nothing separates the mountain lanes** (La Vansa, Gargallà, Espot, Sobrarbe SC: 64-70 m/km, 1-1.7 hamlets). What
   the judge said about them is that they are side loops that cost minutes (R17b), and narrow or posted slow (Sobrarbe
   26 unsafe km). They stay a planner/loop question, not a value one, and are named in the report.
4. Junctions, side ways, buildings (OSM building coverage is uneven: Galicia's parishes have fewer mapped buildings
   per km than the Ma-10), posted limits and narrowness do not separate.
5. A first look, not a fit: fun x a relief factor (0 below 30-40 m/km, 1 above 80-90, floor 0.3-0.5) raises the AUC of
   good lane-class roads against lanes from 0.60 to 0.70-0.72, and to 0.75 with a hamlet term above 4 per 10 km. It
   also takes the CV-70 from 0.78 to 0.33-0.39 (51 m/km at z10) and the great roads' mean from 0.70 to 0.57-0.61.
   So the shape is promising and the guards are the risk; the fit (section 5) decides. The CV-70 at 0.35 is why the
   factor gets a floor of at least 0.5 (section 5).

Caveats: the labels come from my reading of the judge's text; the regions are confounded with relief (most lanes are
lowland, most great roads are mountain), which is partly the point but means the fit must be checked region by region;
z10 is about 120 m a pixel, coarse for climb on a 1 km window.

## 4. Labels for the fit and how they are split

- **Fit set:** the pieces of section 2 (398 good, 369 lanes), plus the spent two-sided set (16 roads, `worth`) and the
  calibration set's dev half (81 stretches, character) as a guard, not a target. Before any fit, `road-scout` checks the
  labels blind of the signals: it reads the piece list (road, area, km, the judge's sentence) and marks any piece I
  labelled against what the judge meant. That is the one cheap way to make the weakest link visible.
- **Cross-validation:** grouped by area (leave one region out: Galicia, Asturias-Cantabria, Catalonia, Aragon,
  Valencia, Andalusia, Castile, Balearics), so a factor that only learns "Galicia is bad" fails on the fold that holds
  Galicia out. Chosen by the grouped AUC and by the guards, never by a single region.
- **Held out, never seen by the fit:** `data/calibration/speed-fun-holdout.json` and its expert ratings (24 roads,
  classics, council lanes and great tertiary roads, `worth` 1-5, built by road-scout for exactly this question and never
  read: `reviews/2026-10-16-speed-aware-fun-step1.md`). The director allowed opening it and its expert file **once, at
  step 4**.
- **Out of sample: 25 fresh trips** (`app/bench/eval/out-of-sample.json`, committed before any fit (5fb7392 after the rebase on main), drawn before any fit by
  `.claude/handoffs/routing-scripts/value_fresh_trips.py`, seed 20261017): 13 regional (50-150 km straight) and 12 cross
  (150-450 km) between mainland towns and villages, no end within 15 km of an end of a kit or bench trip (the side-loop
  labels come from bench stops, the great-road trips are built around labelled roads). Ends are drawn uniformly by area
  and moved to the nearest town or village within 5 km. A first draw, uniform over places, put 8 of the 13 regional
  trips in Castile and Leon; it was replaced by the area draw before anything was fitted. All 25 plan on the v1 data
  (4 to 9 stops). Judged blind by the director, absolute 1-5, v1 and the new version mixed in one round.
- **The kit stays the final test**, and is not a target: no constant is chosen by its pairs or scores. It is partly in
  sample (the fit labels come from the judge's v1/v2 text on kit routes), which is why the held-out set and the fresh
  trips come first and the kit's verdict is reported with that note.

## 5. Mechanism (data only, no planner rules)

`edgeFunM = length x curve value x pace_factor x relief factor x settlement factor`, computed in the pipeline where fun
is computed today (per way in `graph.py` and per chain in `twisties.py`, the same function in both, or the overlay and
the planner disagree). New named constants, at the top of `roads.py`:

1. `RELIEF_CLIMB_M_PER_KM = (low, high)`: local relief, the climb per km along the road over the curve window
   (`WINDOW_M`), at which the factor is the floor and 1. Only relief along the road enters (climb, or elevation range
   over the window if the fit prefers it); never the absolute elevation.
2. `RELIEF_FLOOR`, **at least 0.5**: no road loses more than half its value to relief (a curvy lane in the lowlands is
   still something, the curve model stays the core, and the CV-70 at 0.35 in the first look is the warning).
3. `HAMLETS_FREE_PER_10KM` and `HAMLET_HALVING_PER_10KM`: hamlets (places within 300 m) per 10 km under which nothing
   changes, and the density above it that halves the fun. Tried second, only if relief alone leaves the parish lanes
   above the passes.

Three constants first, five at most. Hamlets are already in `places.osm.pbf`. `graph.bin` does not change shape (fun
is already stored), so size is unchanged.

New input: the Terrarium DEM at z10 for Spain (about 900-1,300 tiles, about 110-145 MB), under the conditions of the
data-policy review: a separate download step writes `data/raw/dem/` once and skips the tiles it has; at most 4 requests
at a time, an identifying User-Agent, and it stops on 403 or 503; `make data` runs it only when the cache is empty;
`data/raw/dem/SOURCES.txt` records the access date and each tile's `x-amz-meta-x-imagery-sources`; the pipeline's
`meta.json` gets a `sources.elevation` entry ("Terrain Tiles z10 (EU-DEM/Copernicus, SRTM)" and the date). The app's
DEM credits (Copernicus, USGS, NOAA, "modified") are the app session's, and the ODbL scope widening goes under the ODbL
item of the ROADMAP; neither is in this plan. For the record: the diagnosis above fetched 179 z10 tiles (24 MB, one at
a time, urllib's default User-Agent) into the session scratchpad, before these conditions existed; the pipeline will
not reuse them.

Alternatives measured the same way, not mixed in: family 2 of the speed-aware fun (`twisty-fam2`), alone and with the
relief factor, against the same labels and the kit (it lifts flowing roads, which is the right direction, and lanes,
which the relief factor might cancel).

## 6. Bar

- Held-out set (read once): the great tertiary group above the lanes and the classics above the lanes in at least 70 %
  of the pairs 1.5 apart (today 0 of 63 on the spent set), Spearman with `worth` positive for both raters.
- Out-of-sample trips (the 25 fresh ones): the default and most-fun stops of v1 and of the new version, judged blind
  in one round by the director, absolute 1-5; the new version's mean not below v1's, and up on the trips where the
  route changed. Being judged in the same round, the two versions share the judge's drift.
- Kit, judged blind against v1 and v2 by the director, same prompt, changed items mixed with as many unchanged anchors:
  misses won up from the corrected v1 (43 and 39 of 62 per round; 13 lost in both), sample mean up by more than the
  anchors' drift (+0.23 to +0.28 in v2).
- Bench on scratch data: **zero G1** (a G1 change goes to the maintainer); recall 62 of 110 and 8 of 22 no worse; the
  lanes guard (LLN-, PI-, CB-, CO-, HF, SC-222 down or level) and the sweepers guard (N-111, A-367, N-260, N-621,
  AS-114, N-110, CV-800 up or level); default-stop extra minutes not up more than 10 %; the great roads' mean fun and
  the km at rating 4-5 reported (the stop rules and `CURVY_EDGE_SHARE` live in the fun scale: any scale constant that
  needs retuning is named with its measured effect, not retuned quietly).
- The village lanes the maintainer accepted (Sort, Tremp, 2026-10-15): reported before and after; if they go down, that
  is the maintainer's call, with overlay shots.
- `graph.bin` size and `plan()` time on the Huawei noted (no change expected: same graph shape, same planner).

## 7. Separate small fix: "unsafe km"

The judge read "unsafe km" (kit card, `card.ts` `unsafeM`: tracks, posted 40 or less, fords) as danger on Beget, C-462,
A-1702 and Vidrà. The app does not say "unsafe": its chips already say "Signed 40 km/h", "Narrow" and "Ford" with the
note that the limit warns about the bends. So the fix is only the kit's next version (v1 stays frozen): split the
figure into "tracks km", "signed 40 km/h or less, km" and "fords", and word the prompt as "slow-signed, not dangerous".
`rider-safety` reviews the wording before it goes in. Decided (director): later, after item 9, so v1 stays
comparable.

## 8. Steps and cost

| step | work | machine |
| --- | --- | --- |
| 1 road-scout checks the labels (section 4): the director runs it on `data/eval/road-value/labels-for-scout.md` | the subagent, an hour | none |
| 2 DEM download step (the conditions of section 5) and the relief factor in the pipeline behind the constants, tests | half a day | DEM download once, ~110-145 MB |
| 3 Fit on the pieces with grouped CV: relief, then relief + hamlets, then family 2 combined | half a day | seconds per candidate (a piece-level harness, no rebuild) |
| 4 Held-out set, once; verdict | an hour | seconds |
| 5 Scratch rebuild of the best candidate (`make data` equivalent, ~17 min), candidates, bench, guards | two hours | one heavy slot |
| 6 Out-of-sample dossier (the 25 fresh trips, v1 and new, mixed and blind: a `--trips` option to the kit's `eval` that writes only the absolute cards, through `card.ts`), then the kit dossier on the new data; the director judges both | half a day of mine, then the director | minutes |

About two days to step 5; one if step 3 or 4 says "no change", which is an allowed answer, reported with the numbers.

## Needed from the director

1. The road-scout check of step 1, on `data/eval/road-value/labels-for-scout.md` (770 pieces: 401 good, 369 lanes, each
   with road, area, km, source, my label and the judge's sentences of the item it comes from; no signal or model
   figure). A JSON copy for mapping the marks back is `labels-for-scout.json` next to it. Step 3 waits for it; step 2
   does not.
2. Nothing else: frame, held-out read, DEM and kit v2 timing are decided.

## Results so far (2026-10-16)

- **Step 1, labels.** road-scout marked 182 of 770 pieces and found the list biased: road class and region give the
  label away, relief is confounded with region, the R17b pieces are circular. Cleaned (`data/eval/road-value/
  cleaned-labels.md`): marks applied, R17b-only pieces, tunnels, town streets and dual carriageways dropped, one label
  per road: 234 roads (78 good, 156 lanes). AUC over pairs inside one class and region: today's fun 0.62, the pipeline's
  climb per km 0.82. Hamlets were region (0.45-0.49 inside a region) and are dropped. Correction to section 3: the
  pipeline's climb (1 km window, bilinear DEM) reads lower than the diagnosis's (whole piece, nearest pixel): medians
  40-54 m/km on good local roads and 15-32 on lanes.
- **Counter-examples.** 12 of 27 of road-scout's matched the graph cleanly; 7 good (none in Galicia: all three Galician
  lines failed to match), 5 lanes, and all 12 lanes are dead ends, kept out of the fit. Known limits, accepted by the
  director: no good road in Galicia, no mountain through-lane.
- **Step 3, fit** (`data/eval/road-value/fit-step3.md`): leave-one-region-out AUC 0.721 against 0.612 with
  `RELIEF_CLIMB_M_PER_KM = (40, 50)` and `RELIEF_FLOOR = 0.8` (de59580), the same ramp in every fold; the fit alone
  would take the lowest floor (0.742 at 0.5, CV-345 -46 %), the director chose 0.8. Great roads -8 % on average, lanes
  -17 %.
- **Step 4, held-out set, read once: the bar is not met.** 24 of 24 matched. Spearman of worth with the value, today ->
  candidate: scout -0.11 -> -0.07, expert -0.12 -> -0.08 (bar: above 0.3); classics above lanes 12 % -> 14 % of
  pairs (bar: 70 %); great tertiary above lanes 53 % -> 52 %. Cause, measured on the set: its lanes are mountain council
  lanes (climb 21-60 m/km, mean 38) and its classics are low-relief flowing roads (mean climb 27) whose curve fun is
  0.04-0.30 to start with; relief cannot lower the first or raise the second. So relief separates the lowland lanes
  the judge saw in the kit and does not measure a road's worth in general. Next: the director's call between "no
  change" and running the product test (bench, the 25 fresh trips, the kit) on the scratch rebuild.
