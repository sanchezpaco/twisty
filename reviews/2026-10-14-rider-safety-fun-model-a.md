# Rider-safety review of fun-model step (a) — 2026-10-14

## Safety review: fun-model step (a), branch `fun-model-limits` @ 55a63f9

I read the tags of every way on the top 30 roads (1,840 ways) and re-ran the gain rule over the whole extract: 82,755 ways, 15,350 km, about 3,463 fun-km. That fun total matches the builder's figure. I also checked the nodes on those ways (barriers, fords, crossings, traffic calming). Scripts and outputs are in `<scratchpad>/safety/` (`gained.jsonl`, `ways.jsonl`, `nodeflags.jsonl`).

**Short answer:** none of the top 30 roads has to lose its gain. The tags show no access limits, no unpaved tags and no barriers on them. The danger is in the long tail. The change gives fun to roads that are one-way, closed by a gate, closed part of the year, destination-only, have fords, or are city streets. Before the change, all of these had zero fun. Now the planner will seek them out.

### 1. Verdict per road

| # | Road | Verdict | Evidence |
|---|---|---|---|
| 1 | C-462 Tuixent–la Seu | OK with a warning (narrow) | `lanes=1` on 30.9 km, posted 40; `surface` missing on 29 km but the road is known to be paved; no barriers |
| 2 | BV-1221 Talamanca | OK | the built-up ways (`lit=yes`, sidewalks, zebra crossings) stay at zero fun |
| 3 | AB-513 | OK | 2 lanes, asphalt, posted 50 |
| 4 | LU-P-1901 | OK with a warning | a single 19.8 km way with no lanes or width tags; it crosses hamlets, and only its middle point is tested |
| 5 | B-122 | OK | `surface` missing on 15 km (the road is paved); some speed bumps and roundabouts |
| 6 | GIV-5221 Oix–Beget | OK with a warning (narrow) | `width=4` with two-way traffic and no `lanes` tag, posted 30. The narrow threshold of 3.5 m misses it |
| 7 | N-625 (Beyos side) | OK with a warning | posted 40 in the gorge (rockfall, trucks); the built-up ways stay at zero |
| 8 | MCT (Mancomunidad Canales del Taibilla) | OK with a warning; check access before it goes on the bench's list | 28 km, tertiary, asphalt, 2 lanes, posted 50. No access tag, no barrier node and no operator tag; runs from Las Casicas to near Bojadillas (Nerpio). The name points to a water-authority service road, but nothing in OSM says it is closed. A mapper should check imagery or Mapillary |
| 9 | AS-352 Somao–Vegafriosa | OK with a warning | posted 30 over the whole 17.4 km way, which hints at a tight road |
| 10 | GIV-6703 | OK | `lit=no`, `sidewalk=no`, `smoothness=excellent` |
| 11 | BV-5114 Santa Fe de Montseny | OK | `lit=no`, `maxspeed:type=sign` |
| 12 | CV-147 Desert de les Palmes | OK | many cyclists; `maxweight=18` |
| 13 | DSA-576 | OK | speed humps in the villages; `hazard=animal_crossing` |
| 14 | SC-22109-01 | OK with a warning; check the surface | `lanes=1` on 8.6 km. The northern 6.5 km (Torrelisa–El Casal, ways 740435423/424, 206456301, 695904388) has no `surface` tag. When unsure, treat it as a finding |
| 15 | AS-264 Sotres | OK with a warning | narrow above Poncebos (`lane_markings=no` on 11 km), cattle, tourist traffic |
| 16 | LU-P-5001 | OK with a warning (narrow) | one 12.5 km way with `lanes=1`, `access=yes`, asphalt |
| 17 | CM-1006 | OK | `hazard=curves`, `curves=serpentine`, `maxspeed:advisory=40/30`, rumble strips |
| 18 | GU-211 | OK with a warning | `lane_markings=no` and `shoulder=no` on all 117 ways; `narrow=yes` on 2 ways |
| 19 | BP-2126 | OK with a warning (narrow) | `width=4` on 9 ways with two-way traffic; `surface` missing (the road is paved) |
| 20 | AS-233 | OK with a warning | one 15.6 km way posted 50 with zebra crossings; it may crawl through hamlets (bench check R6) |
| 21 | CA-643 Lunada | OK with a warning | a high pass that closes with snow, and nothing in OSM says so; `smoothness=intermediate` |
| 22 | LU-P-3805 | OK | |
| 23 | JH-7155 | OK with a warning (narrow). Re-check before step 2 lands | 42.5 km, `lanes=1` on 35.5 km, `lane_markings=no` everywhere, posted 30, along the Tranco reservoir inside a natural park. Today its fun is ¼ because it is `unclassified`. Step 2 (ref → tertiary) would put a 42 km single-track road at full fun |
| 24 | Camino de Fuente del Arco a Puebla del Maestre | OK | tertiary, 2 lanes, `smoothness=excellent` |
| 25 | MA-5403 (El Chorro) | OK with a warning | `narrow=yes` on 9 ways; pedestrians and buses at Caminito del Rey; a speed hump |
| 26 | CM-4157 | OK with a warning (rough) | `smoothness=bad` on 6 km, `surface` missing on 5.6 km |
| 27 | CM-2106 | OK with a warning (narrow) | `lanes=1` on 13.3 km, a `hazard=landslide` node, `hazard=animal_crossing` |
| 28 | A-8101 | OK | `smoothness=good` |
| 29 | LU-933 | OK, but its urban ways should not gain | some gained ways carry zebra crossings, traffic lights and raised crossings near Monforte (see finding 5) |
| 30 | LU-P-3807 | OK | |

**Must not gain fun.** None of the top 30 roads. These roads in the tail do:
- **HU-631 Cañón de Añisclo** (ways 268602340, 694600834, 743744659, 1556797961): `oneway=yes`, `width=4`, posted 30.
- **PP-2203** (w84052119, 6.4 km): a node with `barrier=gate` + `access=no`.
- **Carretera d'Espot a Sant Maurici** (w117381210): a gate with `motorcycle=no`.
- **Carretera Particular del Tiro de Pichón** (w30742024): a lift gate with `access=private`.
- **Carretera de la Barquilla** (w488727791): a lift gate with `motor_vehicle=no`.
- **Carretera de El Chorro** (Segovia, w232668167): a lift gate with `motor_vehicle=permit`.
- **Carretera al Cap de Creus**: `motor_vehicle:conditional=no @ (Jun 11-Sep 30)`.
- **Cf-1 Far de Favàritx**: closed `@ (Jun-Oct)`.
- **Camino Rural de Riaza**: closed `@ Dec 1-Mar 1`.
- **Camin des Banhs de Tredòs**: `private @ (Dec 01-May 01)`.
- **LR-340 Carretera Serradero** (w583008196, 5.9 km): `ford=yes` on the way and no `surface` tag.
- **Calle de Arturo Soria** (Madrid) and **Passeig de la Vall d'Hebron** (Barcelona) are in the gained set.

### 2. Narrow roads: the policy I recommend

In order of preference:

1. **Keep full fun and warn in the UI. This is my recommendation.**
   - Classic roads like C-462, GIV-5221 and LU-P-5001 are why riders use Twisty.
   - Cutting their fun to a quarter would in practice drop them from the plans and undo the gain on the bench (C-462 is demanded twice).
   - The risk on a single-track road comes from oncoming traffic in blind bends. A warning addresses that, a lower score does not.
   - Pipeline: export per twisty `narrow_km`. A way is narrow when:
     - `lanes=1` and `oneway` is not `yes`/`1`/`-1`, or
     - `width ≤ 3.5`, or
     - `narrow=yes`.
   - **Implementation trap:** 945 of the 1,943 km of gained `lanes=1` are `oneway=yes` carriageways. Narrow two-way roads are 1,179 km and 315 fun-km, not 1,285 fun-km. A rule on `lanes=1` alone would put warnings on dual carriageways.
2. **Keep the ¼ pace for narrow, unnamed lanes.** It already applies to `unclassified` without a ref or road name. Keep it that way when step 2 lands, and make step 2 promote only roads with a ref or a road name. JH-7155 would then go to full fun with a warning.
3. **Do not use reduced fun (×0.25) or exclusion.** Both lose the best roads, and neither makes a narrow road safer once a rider is on it.
4. `width=4` (GIV-5221, BP-2126; 274 km have widths between 3.5 and 4.5 m) is effectively single-track for two cars. Raising the threshold to 4 is worth testing on the bench, but only for the warning, not for fun.

### 3. Posted limit: yes, show it

When fun ignores a limit of 30–40, the app should say the road is signed that way. Otherwise "Epic" next to a road posted 30 reads as an invitation to speed.
- **Pipeline:** export per twisty `posted_kmh`: the lowest posted limit that covers at least 1 km of the twisty (a named constant), only when it is 40 or less.
- **UI, twisty row** in "Curvy roads on this ride", one chip per road:
  - EN `Signed ${kmh} km/h` / ES `Limitada a ${kmh} km/h`
  - EN `Narrow · ${km} km` / ES `Estrecha · ${km} km`
- **UI, one line under the list** when any twisty has one of these chips:
  - EN "On mountain roads the limit warns about the bends, and narrow roads have oncoming traffic in blind curves. Ride to the signs."
  - ES "En carretera de montaña el límite avisa de las curvas, y en las estrechas viene tráfico de frente en curvas ciegas. Respeta las señales."
- Keep the ETA honouring the limit (`roads.py` `travel_speed_kmh`).

### 4. Pipeline guards, ranked (tag logic)

1. **One-way.** `oneway in {yes, 1, -1, reversible, alternating}` → `fun_weight = 0` until the graph is directed (ROADMAP:94).
   - The ways stay routable but are not sought out.
   - Gained one-way roads: 3,341 km, 233 fun-km. The worst is HU-631 Añisclo, where a GPX can send a rider the wrong way up a one-way canyon road. Then fix the graph properly.
2. **Barrier nodes.** The pipeline ignores node tags entirely, although the prefiltered pbf already contains them (32,654 tagged barrier or access nodes).
   - Cut the way at any node where `access|vehicle|motor_vehicle|motorcycle ∈ NO_ACCESS`, or where `barrier ∈ {block, jersey_barrier, bollard, chain}` without `access|motor_vehicle|motorcycle=yes|permissive`. "Cut" means split the way there and do not join the two halves.
   - Ways with a plain `barrier=gate|lift_gate` and no access tag: zero fun, still routable.
   - On gained ways: 38.9 km with a restricted node and 21 km with a physical block.
3. **Conditional closures.** Any `(access|vehicle|motor_vehicle|motorcycle):conditional` whose value starts with a NO_ACCESS value → zero fun. 160 ways, 47 km.
4. **Destination-only.** `access|vehicle|motor_vehicle|motorcycle ∈ {destination, residents, customers, delivery}` → zero fun (still routable to reach an endpoint). `access=designated` → leave it out (e.g. C-58 Carril BUS-VAO). 61 ways, 19 km.
5. **Street names mean built-up.** A name matching `^(calle|carrer|avenida|avinguda|rúa|paseo|passeig|plaza|plaça|travesía|ronda|glorieta|urbanización|urbanització|polígono)\b`, or containing the word `kalea` or `etorbidea`, sets `built_up=True`.
   - Removes 3,575 km and 359 fun-km from the gains, but only 3.3 km on the top 30.
   - Also add `suburb` to `BUILT_UP_PLACE_KINDS` (builtup.py:15): 1,388 km, 0 km on the top 30. The places extract already has 1,413 suburbs.
6. **Fords.** `ford=yes` on the way → class TRACK. A ford node on the way → zero fun. LR-340 is 5.9 km; ways with ford nodes total 200 km and 50 fun-km.
7. **Bad surface.** `hazard=loose_gravel` → zero fun (GU-166, camino rural de Peralveche a Vindel). `smoothness=bad` → zero fun, or at least the warning chip: 133 km, 37 fun-km, including CM-4157 and A-2304. The comment at roads.py:62 says "bad is fine on a road bike". That holds in a straight line, not leaning into a bend.
8. **`service=driveway|parking_aisle|alley|drive-through`** on a non-service highway → zero fun. Small: 45 ways, 1.5 fun-km.
9. **Do not add an `operator` rule.** On gained ways, 198 of 219 km are "Gobierno de Cantabria", a public road authority. MCT has no operator tag at all, so a one-off check is the only fix there.

Rules 1–4 apply to all ways, not just this step. The gaps existed before, but this change is what puts fun on them.

---

## Scores

- **Surface: 7.** The surface rules hold on tagged ways. But 1,209 km of gained `unclassified` have no `surface` tag (145 fun-km; 417 km of them named Camino/Camí), and `hazard=loose_gravel` passes (roads.py:56-66).
- **Access: 4.** Barrier nodes and conditional closures are ignored, and `destination` is let through. Examples: PP-2203 (gate `access=no`), Espot–Sant Maurici (`motorcycle=no`), Cap de Creus (closed Jun 11–Sep 30). See `is_accessible` in roads.py and osm.py `_parse_way`.
- **Tracks mode: 8.** Off by default (App.svelte:24). Every ride with tracks shows its km and a warning in both languages (en.ts:67-71, es.ts). This change does not touch it.
- **Hazards: 3.** The graph is undirected, and HU-631 Añisclo (`oneway=yes`, posted 30, 4 m wide) now gains fun. Fords gain fun too (LR-340 w583008196).
- **Honesty: 6.** The ETA honours the limit (roads.py `travel_speed_kmh`). But a road posted 30 and one lane wide now shows "Epic" with no limit or narrow note (en.ts:57-74 has no such text).

## Findings

1. **Blocker: one-way roads gain fun on an undirected graph.** HU-631 Añisclo ways (268602340 and others) carry `oneway=yes` and `maxspeed=30`, and the GPX can follow them the wrong way. Gained one-way roads total 3,341 km and 233 fun-km. Fix: guard 1 in `fun_weight`, then the directed graph from ROADMAP:94. Owner: routing.
2. **Major: ways with closed barrier nodes gain fun.** PP-2203 w84052119 has a gate with `access=no`; Espot–Sant Maurici w117381210 has `motorcycle=no`. 49 ways, 38.9 km. Fix: guard 2 in `osm.py`. Owner: routing / pipeline.
3. **Major: seasonal closures gain fun.** Cap de Creus (Jun 11–Sep 30), Favàritx (Jun–Oct), Riaza (Dec–Mar), Tredòs (Dec–May): 160 ways, 47 km. Fix: guard 3. Owner: pipeline.
4. **Major: no limit or narrow note in the UI.** 315 fun-km of narrow two-way road and every road posted 30–40 now gain fun with no word to the rider. Fix: the `posted_kmh` and `narrow_km` export plus the chips and copy in section 3. Owners: pipeline + app.
5. **Major: city streets gain fun.** The built-up test is a 600 m radius around a single node for a whole city, so Calle de Arturo Soria (Madrid) and Vall d'Hebron (Barcelona) qualify: 3,575 km, 359 fun-km. Fix: guard 5. Owner: pipeline.
6. **Major: fords gain fun.** LR-340 w583008196 (`ford=yes` on 5.9 km); 200 km of ways with ford nodes. Fix: guard 6. Owner: pipeline.
7. **Minor: destination-only ways gain fun.** Santimamiñe errepidea and Fageda d'en Jordà are `motor_vehicle=destination`. Fix: guard 4. Owner: pipeline.
8. **Minor: the narrow-km figure in the review is overstated, and a `lanes=1` rule would be wrong.** 945 km of `lanes=1` are one-way carriageways. Fix: the narrow definition in section 2. Owner: routing (review doc and future rule).
9. **Minor: only the middle of a way is tested for built-up.** Single long ways (AS-233 15.6 km, LU-P-1901 19.8 km, AS-352 17.4 km) are judged by one point. Fix: mask fun per profile sample within the radius instead of per way. Owner: pipeline.
10. **Minor: the step-2 interaction.** Step 2 (ref → tertiary) would give JH-7155, 42.5 km of single track, full fun. Fix: re-run this review on step 2 and require the narrow chip before it lands. Owner: routing.
11. **Minor: two doubtful roads to check by hand.** MCT access and the untagged 6.5 km of SC-22109-01. Fix: check imagery or Mapillary before either joins the bench's demanded list. Owner: road scout.
12. **Minor: rough and loose surfaces gain fun.** `smoothness=bad` (133 km) and `hazard=loose_gravel` (GU-166). Fix: guard 7. Owner: pipeline.

## What works, don't break it

- The ETA still honours the posted limit (`travel_speed_kmh`). Keep it, because fun ignoring the limit must never turn into time ignoring it.
- The tag-based built-up evidence (`ES:urban`, `lit=yes`, `sidewalk`) correctly keeps the town parts of BV-1221, N-625, AS-264 and C-462 at zero.
- `is_paved`, `is_accessible` and `is_passable` still run before fun. No top-30 road carries an unpaved, private or impassable tag.
- Tracks are off by default, and the tracks warning appears in both languages with GPX as the main export.
- The gains bring back the roads riders want (C-462, GIV-5221, BV-5114, CA-643, the Mare de Déu del Mont road). Every guard above takes away fun or access only on explicit tags or names, so none of them touches the top 30 beyond 3.3 km of street names.

