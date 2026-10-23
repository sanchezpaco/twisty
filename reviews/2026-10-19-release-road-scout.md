Road-scout review for release step 1 (main 5b9590d, data 3311fa55967b0a48)

The shipped build finds Spain's known great roads well enough for launch in the regions we test. No road was lost and I found no blocker. The weak point is the validation set: it covers 9 of the regions a Spanish rider would try first with no road at all, and on trips the planner was not tuned on it finds only 7 of 22 roads. I also planned 19 new classics (20 entries: 18 located, 2 did not). The planner rides 22 of the 27 road-and-trip pairs those trips ask for, and misses 3 roads a rider would notice.

**1. G1 and recall on this build**
- **Against the committed baseline** (`app/bench/baseline.jsonl`, 6d6c15e, recorded from f618493-dirty, same data hash): all 127 trips are identical, 0 roads lost, 0 gained. The accepted trades (oneway's 4, orienteering's 3) are already in that baseline, so nothing beyond them is lost.
- **Recall:** 82 of 131 demanded pairs.
  - Tuning trips: 75 of 109.
  - Holdout trips: 7 of 22.
- **Never found:** every through road is found at least once. The only roads never found are the three dead ends (Mare de Déu del Mont, Tost, Santa Engràcia), which are out of demand by decision.
- **Weakest roads** (pairs found of pairs demanded):
  - CV-345 Alpuente–Titaguas: 1 of 6.
  - C-462 Tuixent–La Seu: 1 of 4 (accepted trade).
  - A-1702: 1 of 3.
  - CV-345 Villar–Alpuente: 3 of 6.
  - CA-643, BV-5114, BV-5301: 4 or 5 of 8 to 11.
  - N-502: 2 of 7.

**2. Regional coverage of the set**
- The set has 28 roads. Catalonia has 13 (3 of them dead ends) and Valencia/Alicante 6.
- **Thin:**
  - Andalucía 5.
  - Cantabria 2.
  - Asturias/León 2.
  - Gredos 1, and only a 7.6 km piece of N-502.
  - Aragón 1, the Teruel Maestrazgo (A-1702).
- **None at all:** Madrid, Navarra, Basque Country, the Aragonese Pyrenees, Galicia, Extremadura, Balearics, La Rioja/Burgos/Soria, Murcia.
- **Canary Islands:** they are not in the build at all (finding 1).
- **Day-one classics we have never tested:**
  - Picos/Cantabria: N-621 San Glorio, CA-280 Palombera, CA-184 Piedrasluengas.
  - Asturias/León: AS-260 Fito, N-630 Pajares.
  - Aragonese Pyrenees: A-1205 Oroel, N-260a Cotefablo, N-260 Coll de Fadas.
  - Navarra and Basque Country: N-135 Erro, GI-3440 Jaizkibel.
  - Madrid: M-611 Morcuera, M-629 Canencia.
  - Extremadura: CC-224 Honduras.
  - Andalucía: A-7000 Montes de Málaga, A-4050 Carretera de la Cabra, A-366 Ronda–El Burgo, A-372 Grazalema.
  - Mallorca: Ma-10 Tramuntana.
  - Galicia: OU-0508 Cañón do Sil, LU-651 Courel.
  - Canaries: TF-436 Masca, GC-200.
- I checked these with a bench run on a scratch copy (2 workers, 7 s, in a heavy slot):
  - 18 entries located in the graph. A-4050 and LU-651 did not (finding 12).
  - 22 of 27 demanded pairs were found.

**3. Misses a rider would notice at launch** — findings 2, 3 and 6 below.

**4. Is the set good enough to gate releases?** As a regression check, yes: runs are repeatable and a lost road fails the run. As a quality gate for a Spain launch, no:
- 9 regions have no road in the set.
- The holdout has only 22 pairs.
- Holdout recall is 32%, against 69% on tuning trips.

Add the 15 roads below as holdout roads, so they cannot be tuned on, then re-record the baseline in its own branch.

## Scores
- **Coverage: 6.** 25 of 25 through roads are located in the graph. But CV-345 Alpuente–Titaguas is 0% on the overlay, CV-35 Tuéjar–Titaguas 38% (fun 28%), C-28 Bonaigua 43%, CV-35 Titaguas–border 47% (`5b9590d__report.md`:20-30). 9 regions have no road.
- **Found: 6.** Recall is 75/109 on tuning and 7/22 on holdout. Between 30 and 90 min of detour, tuning finds 40/72 and holdout 5/19 (one-sided Fisher p≈0.02). The cheapest miss is N-502 at 15 min.
- **Character: 6.** The JV-7032 (Epic), CV-363 (Epic/Very winding), GIV-5221 and CV-70 (Very winding) words are right. Bonaigua shows "Flowing" on all 12 stops that ride it, and Somiedo shows "Flowing" on 7 of 9.
- **Regression: 9.** 127 of 127 trips are identical to baseline 6d6c15e; D3 and D4 show nothing lost (`5b9590d__summary.json`).

## Findings

**Blockers:** none.

**Major**

1. **The Canary Islands are missing from the build, but the PRD promises them.**
   - Evidence: `PRD.md:6` says "Spain (mainland, Balearic and Canary Islands)". `meta.json` bounds start at lat 36.01. `places.json` has 0 places south of lat 30. The Makefile only downloads geofabrik `europe/spain`, which excludes the Canaries.
   - A rider in Tenerife or Gran Canaria finds no town.
   - Fix: either add geofabrik `africa/canary-islands` to the pipeline, or scope the PRD and the Play listing to "Península y Baleares" for launch.
   - Owner: director (scope), GIS.

2. **A-1702 is missed on its own trip.**
   - Trip: Alcañiz → Cantavieja (holdout). It costs 45 min and no stop rides it, although the twisty file has it as a 42.5 km "Very winding" (r4) road. It is also missed on regional-011 (73 min).
   - What the slider offers instead: +9 A-226 (Flowing); the default +29 A-2406 + A-226; +50 CV-121; +60 to +82 A-2409/A-226/TE-710.
   - Fix: check whether A-1702 reaches the candidate frontier as one candidate.
   - Owner: routing.

3. **N-502 Puerto del Pico is the cheapest miss in the set.**
   - Trip: San Román de los Montes → Sigeres (holdout). It costs 15 min and no stop rides it.
   - What the slider offers instead: +13 M-548/M-541 ("Flowing", 46 twisty km), +23 AV-503 (Flowing), the default +37 AV-901.
   - The planner pays 13 min for flowing roads and skips the Gredos icon.
   - Owner: routing.

4. **Holdout recall shows the planner fitting the trips it is tuned on.**
   - Evidence: 7/22 on holdout against 75/109 on tuning. On "great" trips alone: 4/10 against 61/78. Cross trips: 3/19.
   - Fix: make holdout recall the headline number. Grow the holdout with the new roads; `tunedThrough` in `app/bench/great-roads.json` is null today. Judge any further tuning on holdout recall.
   - Owner: routing (bench), director (gate).

5. **The character word undersells classics on long chains.**
   - C-28 Bonaigua: "C-28 26 km, Flowing" on all 12 stops that ride it, although the pass rates r4 (7.5 km) and r3 in the twisty file.
   - AS-227 Somiedo: "Flowing" (48-52 km) on 7 of 9 stops.
   - CV-345 Villar–Alpuente: "Flowing" (24 km) at the default +40 of the fixed trip València → Los Santos. The twisty file has it as three r3 pieces.
   - N-502 Pico: a 7 km "Gentle" piece.
   - Cause: a long chain is rated by its average, so straights dilute the word.
   - Fix: rate a chain by its best sustained stretch, or show the peak. This is the open ROADMAP item "Stable character per road section".
   - Owner: GIS, then app for the copy.

6. **Three new classics are missed or found far too late** (scratch run).
   - CA-280 Palombera on Reinosa → Cabezón de la Sal: costs 12 min, no stop rides it. The slider offers N-611 Pesquera ("Gentle/Flowing") at +9 and +16, and N-623/CA-602 at the default +40.
   - N-260 Coll de Fadas on Barbastro → Vielha: costs 24 min, no stop rides it. The slider offers +24 HF29 + 12 km of N-260, and the default +28 A-2211.
   - A-7000 Montes de Málaga on Málaga → Antequera: costs 38 min but is first ridden at +105 (stop 6). The stops from +17 to +44 ride A-7075.
   - Owner: routing, once the entries land.

7. **Holes in the validation set.** 9 regions have no road, and Catalonia holds 13 of 28.
   - Fix: add the short list below.
   - Owner: road-scout supplies; routing writes the entries and the trips as holdout and re-records the baseline in its own branch.

**Minor**

8. **The fastest route on a new trip U-turns on a dual carriageway.**
   - Trip: Reinosa (-4.1406, 43.0012) → Cabezón de la Sal (-4.2355, 43.3075).
   - Stops 0 to 2 fail H14 noCarriagewayUTurn, a hard check (`app/bench/planTrip.ts`:59); the fastest route itself turns back from one carriageway onto the other.
   - The current set never triggers it.
   - Owner: routing.

9. **The rider's own classics are only partly on the map.**
   - CV-345 Alpuente–Titaguas has no twisty at all (0% on the overlay, graph fun 45%) and is found on 1 of 6 trips.
   - CV-35 Tuéjar–Titaguas: 38% on the overlay, 28% fun.
   - Owner: GIS.

10. **Graph splits that block entries.**
    - A-4050 Carretera de la Cabra: the first try was flagged a dead end; ending at the Játar junction (-3.7254, 36.9351) made it unlocatable.
    - LU-651 Courel is split by a way named "Desvío provisional LU-651", so a ref-only entry cannot join it.
    - Fix: both need via points or a name added to the entry.
    - Owner: GIS.

11. **Report only: the default stop rarely rides a great road.** It rides a demanded great road on 41 of 131 pairs; the max-curves stop on 34 of 131. The "some stop" rule stays closed. A "found at the default stop" line in D4 would show what the rider sees first.
    - Owner: routing (bench).

## Roads to add (each tested on a scratch copy of the bench)

| # | Road | Region | From | To | Trip | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | N-621 San Glorio | Picos | (-4.6299, 43.1362) | (-4.8899, 43.0046) | Reinosa → Riaño | found at +75 |
| 2 | CA-280 Palombera | Cantabria | (-4.2205, 43.0360) | (-4.2984, 43.1783) | Reinosa → Cabezón de la Sal | missed at 12 min |
| 3 | AS-260 Mirador del Fito | Asturias | (-5.2552, 43.4787) | (-5.1916, 43.3943) | Gijón → Cangas de Onís | found at +9 |
| 4 | N-630 Pajares | Asturias/León | (-5.7740, 43.0783) | (-5.7506, 42.9914) | Oviedo → León | found at +7 |
| 5 | A-1205 Oroel | Jacetania | (-0.5541, 42.5663) | (-0.6515, 42.4060) | Huesca → Jaca | found at +67, max-curves stop only |
| 6 | N-260a Cotefablo | Sobrarbe | (-0.1230, 42.6071) | (-0.3008, 42.6207) | Jaca → Aínsa | found at the default +36 |
| 7 | N-260 Coll de Fadas | Ribagorza | (0.4983, 42.5133) | (0.7094, 42.4515) | Barbastro → Vielha | missed at 24 min |
| 8 | N-135 Erro/Mezkiritz | Navarra | (-1.5028, 42.9362) | (-1.3482, 42.9774) | Pamplona → Ochagavía | found at +25 |
| 9 | GI-3440 Jaizkibel | Gipuzkoa | (-1.9099, 43.3245) | (-1.8020, 43.3663) | Donostia → Hondarribia | found at +18 |
| 10 | M-611 Morcuera | Madrid | (-3.7688, 40.8130) | (-3.8779, 40.9053) | Collado Villalba → Buitrago | found at +56 |
| 11 | M-629 Canencia | Madrid | (-3.7688, 40.8130) | (-3.7101, 40.9432) | Rascafría → Buitrago | found at the default +44 |
| 12 | CC-224 Puerto de Honduras | Extremadura | (-5.7797, 40.2082) | (-5.8792, 40.2468) | Plasencia → Béjar | found at +58 |
| 13 | A-7000 Montes de Málaga | Málaga | (-4.3402, 36.9031) | (-4.4110, 36.7447) | Málaga → Antequera | found only at +105 |
| 14 | Ma-10 Sóller–Lluc | Mallorca | (2.7045, 39.7784) | (2.8895, 39.8133) | Palma → Pollença | found at +57 |
| 15 | OU-0508 Cañón do Sil | Ribeira Sacra | (-7.6606, 42.4061) | (-7.5725, 42.3796) | Ourense → Monforte de Lemos | found at +98 |

- Adding A-1205 also gives the Huesca → Jaca fixed trip its first demanded road; today it demands none.
- **Next, already tested and found:** A-366 Ronda–El Burgo (+26), A-372 Grazalema (+24), CA-184 Piedrasluengas (+46).
- **After the GIS fixes in finding 10:** A-4050 and LU-651.
- **Once the Canaries extract is in:** TF-436 Masca, TF-24 La Esperanza, GC-200.

## What works, don't break it
- 0 roads lost, and every trip identical to baseline 6d6c15e.
- Cheap detours are found: 35 of 37 tuning pairs that cost 30 min or less.
- These roads are found on every trip that demands them: Vidrà (7/7), CV-363 (5/5), N-260 Port del Cantó (5/5), C-462 Coll de Port (4/4), CV-35 Tuéjar–Titaguas (6/6), JV-7032 (2/2, rated "Epic").
- Mallorca is in the graph: Ma-10 is 97% on the overlay and ridden on Palma → Pollença.
- The Madrid passes, Pajares, Fito, Jaizkibel and Erro are found within +25 to +56.

## Files
Scratch bench inputs and output (the entries are ready to copy into `great-roads.json`):
- <scratchpad>/scout/bench1/bench/great-roads.json
- <scratchpad>/scout/bench1/bench/trips.json
- <scratchpad>/scout/bench1/out/report.md
- <scratchpad>/scout/bench1/out/results.jsonl

Bench output reviewed: data/review-2026-10-19/bench/5b9590d__report.md and 5b9590d__results.jsonl in the same folder.
