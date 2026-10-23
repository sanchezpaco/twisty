# Rider-safety review: ford rule and fun-model step (c) — 2026-10-14

## Second rider-safety review: ford rule and step (c)

Short answer: use rule (c) plus (d) for fords. Numbered tertiary-or-higher roads keep their fun and get a "Ford" chip, but perennial river and canal crossings and `unclassified` ways stay at zero. That gives CV-363 back. Step (c) needs four guards before it lands, and the narrow chip has to reach the UI first.

Scratch files are in `<scratchpad>/safety2/`:
- `fordctx.json`: every ford node with the ways through it and the waterways, culverts and bridges within 40 m.
- `hist.json`: OSM API history and changeset tags for the 261 ford nodes on the 191 ways.
- `gainc_ways.jsonl`: all 6,005 ways that gain in step (c). It reproduces the review's 8,202 km and 3,743 fun-km.
- `siblings.json`: other ways with the same ref or name that are unpaved.

Scripts are in `../s2scripts/`.

### 1. Fords: the rule

**Evidence**
- **Waterways at the 261 ford nodes:** 239 sit on a stream, 19 on a river (mostly dry Almería ramblas tagged `intermittent`), 2 on a canal, 1 on a ditch and 6 on no waterway at all. 196 are intermittent.
- **Who added the fords:** the OSM API shows that 121 of the 261 came from iD changesets with `resolved:crossing_ways:highway-waterway`. That is the "connect with a ford" quick-fix offered when someone draws a stream across a road. 103 were added in 2025–26, and only 13 come from changesets that mention a survey. One mapper importing IGN barrancos ("añado barrancos a partir del IGN") added 49 of them.
- **CV-363:**
  - node 5235317079: JOSM "validation fixes", 2017
  - node 9314841229: iD, 11 crossing warnings resolved, 2021
  - node 13281344988: the IGN barranco import, 2025
  - All three are intermittent barrancos and none was surveyed. A mapping artefact or a dry dip in the road.
- **MA-8301 / MA-8302:** added in the HOT task #SpainFloods2026 by a remote mapper (Apr 2026). MA-8302 has 5 fords within 140 m on one stream way (1502533512) drawn zig-zagging across the road, so the geometry is wrong, not the road.
- **NA-4453:** iD crossing fix (2020), concrete road, intermittent stream.
- **CV-438:** IGN import (2024), Rambla del Hontanar, intermittent. A plausible real dry dip in the road.
- **Real at-grade crossings do exist:** AL-7105 has 4 crossings of Rambla de la Ballabona and A-399 has fords tagged `seasonal=yes`. They are fine dry and dangerous in a flash flood. So they deserve a chip, not zero fun.
- **Likely bogus:** DP-3902 and DP-3903 (Río Lambre, a perennial river, iD fix) and N-340 node 248183273 (culvert 40 m away). These are probably bridges or culverts.

**Rule (tag logic)**
```
ford_keeps_fun(way) :=
  raw OSM highway ∈ {trunk, primary, secondary, tertiary}   # the tag, NOT the class after step (c)
  ∧ ref present
  ∧ way has no ford=yes                                        # LR-340 stays a track
  ∧ ∀ ford node on the way: no waterway through it with
        waterway ∈ {river, canal} ∧ intermittent ≠ yes
→ keep fun and set the edge's ford flag; otherwise fun 0 (as today) and set the ford flag.
```
- Set the ford flag on every edge with a ford node, including zero-fun edges, because those stay routable.
- One flags byte is enough: bit 0 means ford. A whole third per-edge byte is not needed.

**What the rule leaves**
- **Keeps fun with the chip:** 169 ways, 570 km, 282.3 fun-km, including:
  - CV-363 (all 3 ways, 5.0 fun-km)
  - MA-8301 (22.5)
  - MA-8302 (12.2)
  - NA-4453 (10.0)
  - CV-438 (9.1)
- **Stays at zero:** 22 ways, 77 km, 17.6 fun-km:
  - 14 `unclassified` ways with a ref (7.4 fun-km): VF-TE-20 with its 27 fords, CR-5001, JV-3012, the GR-1/GR-221/GR-192 hiking refs, CV-1486, DP-4201, HF28.
  - 8 perennial river or canal crossings (10.2 fun-km): DP-3902, DP-3903, DP-7901, AL-6301, SR-1, JA-3102, TO-1151, CU-V-3131.
- **Rejected options:**
  - (a), the guard for all, throws away 282 fun-km that is mostly artefacts.
  - (b), exempt every ref, lets VF-TE-20 through.
  - Also zeroing perennial streams loses 99 fun-km, including MA-8301, whose fords are quick-fix artefacts.

**Copy**
- Chip: EN `Ford` / ES `Vado`.
- Line under the list:
  - EN "Mapped fords are usually dry dips. If water is running across the road, turn back."
  - ES "Los vados suelen ser badenes secos. Si el agua cruza la carretera, da la vuelta."

### 2. Step (c): verdict per road (after the guards from step (a))

| Road | Verdict | Evidence |
|---|---|---|
| JH-7155 | OK with the narrow chip, once the chip is shown | asphalt on all 15 ways; 40.4 of 47.4 km `lanes=1`, posted 30; no gates; reservoir road in a natural park |
| Vidrà–Sant Privat | OK; check the middle | asphalt at both ends; 15.9 km untagged; no unpaved stretches under the same name |
| Carretera de Peramola | OK | asphalt on all 6 ways; nothing tagged on its nodes |
| CHE-1403 | Must not gain | 33.7 km with no surface tag; `access=permissive` on all 11 ways; Ebro water-authority canal road |
| Solsona–Cambrils, Pobleta–Gerri, Uña, Amogable, Juan Quílez, Solsona–Bassella, the Courel estradas (Cereixido, Vilarmel, Serra Seca) | Check before the bench | 13–20 km each with no surface tag; several have mountain-pass nodes; Amogable is forestry land |
| Etxalar–Zugarramurdi | OK with a warning | cattle grid node |
| Rat-Penat, Rossell–Vallibona, Mare de Déu del Mont, Vall del Bac, Tortosa–Perelló, JA-7155, Montan de Tost, Tor, Rialb, Güel | OK | paved tags; posted 30–40 where tagged |
| HF15 | OK with the narrow chip | asphalt, `lanes=1`, posted 30. HF looks like an Aragón forest-road code (HF27 is Camino de Aigualluts), so the ref alone proves nothing |
| HF22, HF16 | Must not gain | `lanes=1`, no surface tag |
| VF-TE-20 | Must not gain | "vía forestal", width 3.5, no surface tag, 27 fords; 3 km still gain about 2 fun-km |
| CR-5001 | Must not gain | 14.5 km under the same ref are mapped as `highway=track` |
| carretera de los Gazquez | Must not gain until its surface is known | 16 km untagged; 1 km under the same name is a track |
| JV-2262, JV-7107, part of JV-2334 | No gain until a surface tag is added | untagged; 19% of the tagged JV kilometres are unpaved |
| JV-2222 | OK with a note | a lift gate with `access=permissive` on one way |
| CH-1 | Check access | 10 km of asphalt, no name; looks like a water-authority road |
| SL-13 | OK | an Asturias municipal code (Salas), not a hiking trail |
| HF27 Camino de Aigualluts | Must not gain | `motor_vehicle=permissive`; closed to private cars in summer (shuttle bus only) |
| Carretera del Coll de Banyuls (tail) | Must not gain | narrow, untagged; from what I know the Spanish side is gravel |

### Step (c) guards, ranked (tag logic)

These are applied in order; the numbers are what each one removes from the 3,743 fun-km step (c) adds.

1. **A ref alone needs a paved tag.** Promote on `ref` (without a road name) only when `surface` is a paved value or `tracktype=grade1`.
   - Removes 558 ways, 921 km, 339 fun-km.
   - Why: among ref'd `unclassified` ways that carry a surface tag, 33% are unpaved (354 of 1,088 km). By family: CP 80%, CA 85%, SE 86%, PR-A 100%.
   - This also covers Camino names with a ref and hiking or forest refs.
2. **Narrow without a paved tag stays a quarter.** `is_narrow` and no paved surface tag means no promotion.
   - Removes 109 ways, 137 km, 68.6 fun-km (Coll de Banyuls, Pico del Águila, Artedó).
3. **Unpaved stretches of the same road.** If a way with the same ref, or the same name within about 10 km, fails `is_paved`, the untagged ways of that road are not promoted.
   - Removes 121 ways, 125 km, 55.5 fun-km.
4. **Permissive access.** `access`, `motor_vehicle`, `vehicle` or `motorcycle` set to `permissive` means no promotion.
   - Removes 16 ways, 13 km, 6.8 fun-km.
5. **Trap in the ford rule.** The ford rule must test the raw `highway` tag. `local_road_class` already turns these ways into TERTIARY, which would exempt VF-TE-20 and CR-5001.

After these guards step (c) keeps 3,273 fun-km (87%). Of that, 418 km are narrow, and 3,664 km still have no surface tag. That last group needs a road-scout list, not a chip.

**Is the narrow chip enough?** For narrow roads tagged paved, yes, but only once it shows. `narrowM` and `postedKmh` stop at `ride.ts:186-187`: no component uses them and en.ts/es.ts have no copy for them. Narrow roads that are not tagged paved need guard 2.

---

## Scores
- **Surface: 5.** As it stands, step (c) promotes 2,252 fun-km on ways with no surface tag. That includes 341 fun-km on refs alone, a group that is 33% unpaved where tagged, and CR-5001 next to 14.5 km of track under the same ref.
- **Access: 7.** The step (a) guards hold. Owner-allowed roads (`permissive`: CHE, HF27 Aigualluts) are still promoted.
- **Tracks mode: 8.** Still off by default (`App.svelte:24`); copy in both languages is at `en.ts:31-34,67-72`.
- **Hazards: 6.** Fords now get zero fun but stay routable, and the rider is never told: no ford flag reaches the app.
- **Honesty: 5.** The chip data is exported, but no UI renders `narrowM` or `postedKmh`. Step (c) adds 418 km of narrow road at full fun.

## Findings
1. **Blocker.** Step (c) promotes refs that have no surface tag. Evidence: CR-5001, CHE-1403, VF-TE-20 and HF22; 921 km. Fix: guard 1. Owner: pipeline.
2. **Blocker.** The narrow and posted-limit chips are not rendered, and step (c) puts JH-7155 (40 km of single track) at the top of the gains. Evidence: no use outside `app/src/lib/routing/ride.ts`. Fix: render the chips and add their copy before step (c) lands. Owner: app.
3. **Major.** The ford guard zeroes 282 fun-km that are mostly quick-fix artefacts, including CV-363. Fix: the ford rule plus the flag byte, the chip and the copy above. Owners: pipeline, routing, app.
4. **Major.** Rides cross fords with no notice. Fix: set the ford flag on every edge, whatever its fun. Owners: pipeline and app.
5. **Major.** Narrow roads with no surface tag get promoted (Coll de Banyuls). Fix: guard 2. Owner: pipeline.
6. **Major.** Roads with unpaved stretches under the same name or ref get promoted (los Gazquez, Carretera del Canal). Fix: guard 3. Owner: pipeline.
7. **Minor.** Permissive owner roads get promoted (HF27 Aigualluts, CHE). Fix: guard 4. Owner: pipeline.
8. **Minor.** The ford rule's class test could use the promoted class instead of the OSM tag. Fix: test the raw tag (item 5 of the guards). Owner: pipeline.
9. **Minor.** The top untagged "Carretera" roads are unverified (Vidrà middle, Pobleta–Gerri, Uña, Amogable, the Courel estradas, CH-1 access). Fix: check imagery or Mapillary before any of them joins the bench. Owner: road scout.

## What works, don't break it
- `is_paved` runs before the class.
- `ROAD_NAME` leaves Camino, Camí, Pista and unnamed lanes at a quarter.
- The step (a) guards (one-way, barrier cuts, conditional closures, destination-only, rough surfaces) hold on every road I checked.
- `ford=yes` on a way still makes it a track.
- The ETA honours posted limits.
- Tracks are off by default.
- The roads that matter (Mare de Déu del Mont, Peramola, Vall del Bac, JH-7155 and HF15, both tagged asphalt) keep their full gain under every guard above.

