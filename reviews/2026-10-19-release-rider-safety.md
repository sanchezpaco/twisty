## Rider-safety review: release round, main 5b9590d (2026-10-19)

**Short answer:** not yet. The app keeps riders off gravel tracks: 0 track metres in all 1,103 options I re-planned (127 bench trips plus the via trips, tracks off). But four things need fixing before a public release:
- The app shows no general safety or legal notice anywhere.
- The GPX line, which the app now recommends, rides town one-way streets against traffic.
- Roads closed part of the year are routed with no notice: Formentor, Favàritx, Lagos de Covadonga.
- Destination-only lanes are used as through roads.

**How I checked**
- Re-planned the bench and via trips on main's data, tracks off, as the shipped app does.
- Matched the stretches I was unsure of to their OSM ways in `data/interim/roads-2a7b7071-located.osm.pbf`. That extract is from Oct 14, the same Oct 13 source as `graph.bin`.
- All in `<scratchpad>/scan/`:
  - scripts: `scan.ts`, `lookup.py`, `neigh.py`, `cond.py`, `seasonal.ts`
  - outputs: `scan.json`, `matched.json`, `neigh.json`, `cond.json`, `condhits.json`

### Scores
- **Surface: 6.** 0 track edges on any route. But default stops ride 93.5 km of `unclassified` ways with no surface or tracktype tag, on 51 of 132 default stops (cross-005: 8.95 km on way/200680011). In Spain 18% of the unnamed `unclassified` ways that do carry a surface tag are unpaved.
- **Access: 6.** The `no`/`private`/`agricultural`/`forestry`/`permit` filter holds. But `access=destination` lanes are ridden as a through route (Ronda), and seasonal closures are routed silently (Ma-2210, Cf-1, CO-4).
- **Tracks mode: 9.**
  - `TRACKS_OFFERED=false` (`app/src/lib/offRoad.ts:5`), and `tracksFor` guards the restored trip, recent trips and Plan again (`App.svelte:55,261,288`).
  - `tracks.bin` is absent from `app/dist/data` and from `app/android/app/src/main/assets/public/data`.
  - 0 track metres in 1,103 options.
- **Hazards: 4.**
  - Town one-way streets are ridden against traffic at the default stop of 91 of 127 bench trips, up to 2.6 km (cross-003).
  - Fords outside the curvy roads are never mentioned (41 stops, 17 trips).
- **Honesty: 6.**
  - Good: times are conservative (the test ride ran at 0.77 of the predicted moving time), the ETA is capped at posted limits (`roads.py` `travel_speed_kmh`), and the Signed / Narrow / Ford chips render (`08-summary-scrolled-huawei-en.png`).
  - Missing: any general notice that a route can be wrong, closed or illegal.

### Findings

**Blocker**

1. **No general safety or legal notice anywhere: first launch, ride, credits or store.**
   - Evidence: `en.ts` and `es.ts` have only the per-chip notes (`ride.safetyLimits`, `ride.safetyFord`) and the tracks copy. `01-first-launch-huawei-en.png` and the credits sheet say nothing about closures, signs, one-way streets or phone use.
   - Why it matters: a public app that sends lone riders onto mountain lanes must say the data can be wrong and that signs win.
   - Fix: copy A (first launch), B (ride summary), D (credits) and E (store) below.
   - Owner: app (copy and UI); director (listing).

**Major**

2. **The GPX line rides town one-way streets against traffic, and the app now recommends the GPX.**
   - Evidence: bench `checks.townWrongWayM` is above 0 at the default stop on 91 of 127 trips. Worst: cross-003 2,596 m, regional-002 1,831, cross-018 1,776, cross-008 1,669, fixed-valencia-los-santos 1,544.
   - `OneWay.IN_TOWN` makes these streets two-way (`roads.py` `with_town_one_ways`).
   - R20 is at 0, so the Google Maps link is fine. But the GPX follows the drawn line, and Open in… now says "we recommend apps that read the GPX directly" (`en.ts` `openIn.advice`).
   - New evidence against the earlier "R19 report only" call: GPX is now the recommended output.
   - Fix now: copy C under the GPX advice.
   - Fix later: "Town streets in the graph" (ROADMAP), or end and restart the GPX track segment around those stretches so apps re-route them.
   - Owner: app (copy); routing (graph).

3. **Roads closed part of the year are routed with no notice.**
   - Evidence: `_is_closed_part_of_the_year` only zeroes fun (`roads.py` `FUN_BLOCKERS`), and the graph has no flag for it. Planned on main:
     - Pollença → Cap de Formentor: 17.6 km of Ma-2210, `motor_vehicle:conditional=no @ (Jun-Oct: Mo-Su 10:00-22:00)`.
     - Es Mercadal → Far de Favàritx: 7.6 km of Cf-1, `no @ (Jun-Oct)`.
     - Cangas de Onís → Lagos de Covadonga: 11.5 km of CO-4, `no @ May 1-Nov 1`.
   - These are classic motorcycle destinations, and the rider sees no chip.
   - Fix: export a "closed part of the year" bit in the edge flags byte. Then show chip + note (copy F) when a ride uses it, or evaluate simple month ranges against today's date and avoid the road when closed.
   - Owner: routing (pipeline, export); app (chip).

4. **Destination-only lanes are used as a through route.**
   - Evidence: way/224859581 "Camino de Ronda a Setenil", way/132462369 and way/132462365, all `access=destination`, about 2 km in the middle of the ride.
   - Default stop of great-a-397-ronda-san-pedro, great-a-397-ronda-san-pedro-ends and regional-033.
   - Cause: `DESTINATION_ONLY` only blocks fun (`roads.py` `_is_destination_only`), so the planner may use such roads anywhere.
   - Fix: flag the edges and give them a heavy cost unless they are within a few km of a trip end or stop.
   - Owner: routing.

5. **Untagged lanes whose continuation is a track stay routable as tarmac.**
   - Evidence: `demote_beside_tracks` only reverts *promoted* ways. A plain `unclassified` way stays routable even when the next way of the same name is a track.
   - Example: "Vereda del Camino de Úbeda a Granada", way/256212674 (1.6 km) and way/256212671. Its continuation way/1230403941 is `highway=track`. Ridden at the cross-006 default stop.
   - Of the 93.5 km of untagged `unclassified` at default stops, 31.4 km on 22 ways end at a track or an unpaved way. Examples:
     - Camí de les Farreres: cross-007, great-bv-5114-santa-fe-ends
     - way/626031493: great-as-227-somiedo-ends
     - pas de Barberà: regional-017
     - way/202721935: regional-021
   - Fix:
     1. An untagged `unclassified` way with a same-name or same-ref track within `SAME_ROAD_TRACK_RADIUS_DEG` becomes TRACK.
     2. Vía pecuaria names (Cañada, Vereda, Cordel, Colada) with no paved tag and no ref become TRACK. Ley 3/1995 allows motor traffic on vías pecuarias only by exception.
     3. Add a transit cost on untagged `unclassified` so tagged tarmac wins ties.
   - Owner: routing.

6. **Surface values outside both lists count as paved.**
   - Evidence: `is_paved` is a blacklist (`roads.py` `UNPAVED_SURFACES`). Counted in Spain:
     - `cobblestone` / `unhewn_cobblestone`: about 250 tertiary, secondary and unclassified ways.
     - Plus `tierra`, `Tierra`, `ripio`, `sin_pavimentar`, `tierra_y_pasto`, `gra`, `grand`, `dirt/sand`, `dirt; asphalt`, `asphalt;gravel`, `rock`, `wood`.
   - None reached a route I probed, but the rule fails on real data.
   - Fix: whitelist (`PAVED_SURFACES` or untagged count as paved, any other value is not). Split `;` values and make the way unpaved if any part is. Treat `unhewn_cobblestone` as rough (no fun).
   - Owner: routing.

7. **Fords outside the curvy roads are never mentioned.**
   - Evidence: the chip comes from `RideTwisty.fordCount` only (`RideSummary.svelte:30,110`). Ride edges with fords outside twisties:
     - fixed-valencia-los-santos default: 4 fords on CV-345 at 39.8905,-0.9596, plus 1 inside a twisty.
     - great-cv-345-alpuente-titaguas-ends default: CV-240 and A-2522.
     - via-valencia-titaguas-teruel default: CV-382.
     - 41 stops on 17 trips in all.
   - Fix: count fords over all of `option.edges` and show the ford note (copy G) when any are outside a twisty.
   - Owner: routing (ride.ts); app (copy).

**Minor**

8. **The R10 queue is mostly false positives.**
   - The largest flagged stretches are autovías: A-66 Ruta de la Plata 310 km, A-231/A-12 "Autovía del Camino de Santiago", A-22 "Camino Catalán", A-496/A-493 "Valverde del Camino".
   - Real items by trip:
     - great-a-397-ronda-san-pedro (+ -ends, regional-033): Camino de Ronda a Setenil, destination-only.
     - cross-006: Vereda del Camino de Úbeda a Granada, track continuation.
     - cross-015: Camino de Valderrubio a Zujaira, 2.5 km, untagged.
     - cross-002: Camino D'Ordoño, 2.3 km.
     - regional-028: Camino Viejo de Coín 5.6 km; Camino Realenga 1.6 km; Camino Lagar de Cadena 0.8 km.
     - cross-029: Camino Viejo de Archivel, 7.3 km.
     - cross-034: Camino de Aldeonte, 3.5 km.
     - cross-022: Camino Santa Marta.
     - cross-006: Camino del Gansino.
   - Fix: skip motorway, trunk and primary classes in `metrics.ts` `suspiciousM`, and add Cordel, Colada, Camiño, Camín, bidea to the regex.
   - Owner: routing.
9. **`app/bench/bad-roads.json` is `{ "roads": [] }`, so the H11 guard checks nothing.** Fix: add Vereda del Camino de Úbeda a Granada and Camino de Ronda a Setenil once they are fixed. Owner: routing, with rider-safety supplying entries.
10. **Directional access is ignored.**
    - `motor_vehicle:backward=no` (54 ways), `access:backward` (15), `access:forward` (7) and `oneway:conditional` (152) leave a way two-way.
    - `motor_vehicle=designated` is not rejected: A-6 Bus-VAO, way/292176583, appears on a non-default stop.
    - Fix: read the `:forward`/`:backward` variants in `travel_direction` and `is_accessible`.
    - Owner: routing.
11. **A finish snaps 4 km away, then planning crashes.**
    - Cap de Creus (3.3155, 42.3192) snaps to the same Cadaqués node as the start.
    - `Planner.plan` then throws "TypeError: Cannot read properties of undefined (reading 'line')" in `segments`, so the rider sees "Something went wrong".
    - Fix: answer `tooFar` or "same place" for equal nodes.
    - Owner: routing.
12. **Gates with no access tag are routable with no chip.** They get no fun, but a locked farm gate mid-route goes unannounced. Fix: put a gate bit in the same flags byte as finding 3, with the chip "Gate" / "Barrera" later. Owner: routing, app.

**Speed and time copy:** nothing pushes a rider to go faster. No km/h is shown except the signed limit, and times are conservative. Keep calibration as an upper reference, not a target (ROADMAP Next up 5).

**Store and Play:** Play has no mandatory disclaimer for Maps & Navigation. Still:
- The full description must not claim "safe", "legal" or "paved".
- It should carry copy E.
- Shots must not show the phone being handled while riding.
- The listing should say Twisty plans and another app navigates.

### Proposed safety copy (EN / ES)

**A. First launch, one line under the intro body.** Owner: app.
- EN: "Routes come from OpenStreetMap and can be wrong: a road may be closed, unpaved, private or one-way. Road signs always win. Plan before you ride and never handle the phone while riding."
- ES: "Las rutas salen de OpenStreetMap y pueden fallar: una carretera puede estar cortada, sin asfaltar, ser privada o de sentido único. Mandan siempre las señales. Planifica antes de salir y no toques el móvil en marcha."

**B. Ride summary footer, always shown.**
- EN: "Check signs and road conditions: Twisty knows nothing of closures, roadworks or weather."
- ES: "Atento a las señales y al estado de la vía: Twisty no sabe de cortes, obras ni meteorología."

**C. Open in… sheet, under the GPX advice.**
- EN: "In towns the GPX line may go against a one-way street: follow the signs."
- ES: "En los pueblos la línea del GPX puede ir contra dirección prohibida: sigue las señales."

**D. Credits sheet, new section "Use at your own risk" / "Uso bajo tu responsabilidad".**
- EN: "Twisty suggests routes for planning only. It does not guarantee that a road is open, paved, legal or safe to ride. Riding within the law and to the conditions is your responsibility."
- ES: "Twisty sugiere rutas solo para planificar. No garantiza que una carretera esté abierta, asfaltada, permitida o sea segura. Circular según las normas y las condiciones es responsabilidad tuya."

**E. Store listing, end of the full description.** Owner: director.
- EN: "Twisty plans the route; Google Maps or your GPX app guides you. Routes come from OpenStreetMap data and may include closed, private, unpaved or one-way roads: always follow road signs, and set the route before you ride."
- ES: "Twisty planifica la ruta; te guía Google Maps o tu app de GPX. Las rutas salen de datos de OpenStreetMap y pueden incluir carreteras cortadas, privadas, sin asfaltar o de sentido único: respeta siempre las señales y prepara la ruta antes de salir."

**F. Seasonal closure (finding 3).**
- Chip: EN "Closed part of the year" / ES "Cerrada parte del año"
- Note: EN "Some roads on this ride close to traffic part of the year: check before you go." / ES "Algunas carreteras de esta ruta cierran al tráfico parte del año: compruébalo antes de salir."

**G. Fords off the curvy roads (finding 7).**
- EN "This ride crosses {n} fords." / ES "Esta ruta cruza {n} vados."
- Followed by the approved `safetyFord` line.

### What works, don't break it
- Tracks are fully off: `TRACKS_OFFERED` + `tracksFor`, the `dropTracks` build plugin (`vite.config.ts`), and 0 track metres on 1,103 options.
- `is_paved` runs before the class, and `ford=yes` on a way still makes it a track.
- `NO_ACCESS` is dropped at both ways and nodes, and blocking barriers cut the graph.
- R20 is at 0: Google pins never sit on a wrong-way town street.
- The Signed / Narrow / Ford chips and their approved notes show on the default ride (HU-631 "Signed 30 km/h").
- The conservative ETA is capped at posted limits, and the copy has no speed language.
