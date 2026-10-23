# Road-scout review of the great-road seeds — 2026-10-13

## Road-scout review of the great-road seeds (main 0366107; data meta 2026-10-13, 644,583 nodes)

**Summary.** All 9 seeds are the right roads, but three have wrong extents or ids:
- **CV-345 north** starts at Casinos instead of Villar del Arzobispo.
- **CV-363** stops 8 km short of its end.
- **CV-35** is not split at Titaguas.

Fixing those raises the València trip from 3 to 5 of 5 found and loses no pair that is found today. The real problem is the pipeline. Many mountain classics have their fun set to zero because their posted limit is 50 km/h or less. And the Vidrà road is cut off from the network, so it can only be ridden as an out-and-back.

I built the bench into the scratchpad and ran it unchanged on the 91 trips. It reproduces 6 of 18. I then ran the corrected seeds (10 of 23) and 18 new roads with my own trips (9 of 18 found). I edited nothing in the repo. Main has since moved on to 965eb54, which committed `app/bench/baseline.jsonl`, so the seed corrections need a rebaseline commit (see the "What works" list).

### 1. Scores

- **Coverage: 4.** All 9 seeds are located. But 5 of 9 have 0–1 % overlay coverage and 0–25 % fun in the graph: Mare de Déu del Mont 0 %, Santa Engràcia 22 %, Vidrà and JV-7032 23 %, Tost 25 %. In my new list, 5 of 18 classics are at 9–36 % fun because of the posted-limit zeroing.
- **Found: 4.** 6 of 18 today. With the corrected seeds, 10 of 23, and València finds 5 of 5. On the new list, 9 of 18 scout pairs are found, and 8 of those 9 are on the fastest route anyway (`runc2`, `runc3` below).
- **Character: 5.** CV-363 shows as "Epic" (rating 5) and CV-345 as "Twisty" (3), which is right. Five seeds show no character at all. GIV-5221, C-462 and BV-5114 show as "Very twisty" (4) on the map but plan at 9–29 % fun.
- **Regression: 6.** The baseline, G1 loss and G2 unlocatable checks exist on main (965eb54). My corrections lose none of the 6 found pairs (`runw2`). Two gaps remain: dead ends are detected only by the degree at the snapped end points, and an id that is renamed or removed silently escapes loss tracking.

### 2. Findings, most severe first

**1. blocker: a posted limit of 50 km/h or less sets the fun of mountain classics to zero.**
- Evidence: `pipeline/twisty_pipeline/roads.py:150` returns 0 when `maxspeed <= URBAN_MAXSPEED_KMH`, even though the comment at `:73` says posted limits are ignored. Mare de Déu del Mont is `maxspeed=30` on every way (e.g. w172397238), giving 0 % fun.
- I scanned the graph for edges of at least 1.5 km with at least 200°/km of turning and zero fun: about 1,930 km. Among them (tags checked in the OSM extract where shown):
  - GIV-5221 Oix–Beget (maxspeed 30)
  - C-462 Tuixent–la Seu (40)
  - BV-5114 Santa Fe del Montseny (40/50)
  - AS-264 Sotres (40)
  - CV-147 Desert de les Palmes (40)
  - BV-1221 Talamanca (50)
  - CA-643 Lunada
  - N-625 on the León side of Beyos–Pontón
- The overlay (`twisties.py:43`, pace factor only) still rates these 3–4, so the map advertises a road the planner ignores.
- Next up 1 as written (unclassified with a ref or a road-like name counts as tertiary) will **not** recover Mare de Déu del Mont.
- Fix: treat a low limit as urban only inside built-up areas (`maxspeed=ES:urban`, `source:maxspeed`/`zone:maxspeed` urban, or a way inside a settlement). Otherwise ignore the limit for fun, as the comment intends. Owner: gis-data-engineer.

**2. blocker for Vidrà: the pipeline drops `highway=residential`, which turns through-roads into dead ends.**
- Evidence: the Vidrà end of "Carretera de Vidrà a Sant Privat d'en Bas" is node [2.3155, 42.1252], degree 1. It sits 100 m from BV-5227. The missing link is w737018081, "Carrer de Ciuret", which is residential.
- As a result its detour costs 95–154 min on every trip, so it is never demanded and can never be found.
- Graph-wide, 1,499 dead ends of named or numbered roads lie within 150 m of another road node. Not all are bugs, but e.g. CV-712 ends 8 m away, RM-515 7 m and CV-195 Jérica–Zucaina 22 m.
- Fix: keep residential ways as low-speed connectors with no fun, at least those that join two kept components. Owner: gis-data-engineer.

**3. major: seed `cv-345-villar-north` starts at Casinos, not Villar.**
- The first 11 km (Casinos to Villar) are flat farmland, at 0–11 % fun.
- València's stop 3 rides only 77 % of the entry, so it counts as missed.
- Fix: `from` [-0.8219, 39.7373]. With that, València finds it at stop 3 (98 %). Owner: routing-engineer (data below).

**4. major: seed `cv-363-losilla-ademuz` ends on a 360 m spur 8 km short of the road's end.**
- It misses the Val de la Sabina section, which is the best part: 92–99 % fun, rated Epic.
- Fix: `to` [-1.2453, 40.0559]. The located length goes from 24.8 to 32.7 km and it is still found on the same trips.

**5. major: CV-35 should be split at Titaguas.**
- Riders who come over CV-345 ride only Titaguas to the border, which is 60 % of today's entry, so the bench says they missed it.
- The entry also runs past Aras de los Olmos to the Cuenca border (CM-2203), not "to Aras".
- Fix: two entries, split at [-1.0835, 39.8631]. València then finds both halves at stops 2–5.

**6. major: dead-end detection only checks the degree of the two snapped end points.**
- Evidence: `app/bench/roads.ts:169`. Vidrà is reported as a through road because its seed ends at the bridge "Pont de les Escanes" (a degree-2 node), yet the chain itself is a dead end.
- Fix: count a road as a dead end when one of its ends cannot reach the rest of the graph without the road's own edges (one bounded search). Owner: routing-engineer.

**7. major: most of today's misses come from generated trips that should not demand these roads.**
- `generate.ts:122` puts A and B "on opposite sides" 170–340 km apart, e.g. Orpesa to San Pedro Palmiches (338 km) and Paracuellos to la Jana (295 km).
- On such trips the 90-minute rule makes CV-345 compete with the Maestrazgo, JF-7038 and A-1701. These trips account for 9 of the 12 misses today and 11 of 13 after the seed fixes.
- The same limit shows up locally: from Alcoi to Benidorm, CV-70 costs only 11 min, but every stop takes the CV-785 Port de Tudons or the CV-780/782 instead, which are equally great.
- Fix, for the maintainer's G1 decision:
  - put A and B 20–60 km beyond each end of the road, along its axis;
  - and/or only count a miss when no stop within the road's cost gains at least the road's fun.
- Owner: routing-engineer, maintainer.

**8. major: the planner misses cheap detours on short trips, with very few stops.** Likely cause: the appetite ladder (`planner.ts:22`, at most 8) and the stop rules (`:27`), but this is not proven. Owner: routing-engineer.

| Trip | Road | Detour cost | Stops (largest extra) |
| --- | --- | --- | --- |
| Pobla de Segur → Vielha | C-28 Bonaigua | 22 min | 2 (+5) |
| Lanjarón → Cádiar | A-4132 | 42 min | 3 (+22) |
| Cazorla → Yeste | JV-7032 | 41 min | 3 (+39) |
| Granollers → Vic | BV-5301 (78 % fun) | 52 min | 5 (+123), none rides it |
| Arcos → Ronda | CA-9104 Palomas (91 % fun) | 40 min | 6 (+79), none rides it |
| Alcañiz → Cantavieja | A-1702 | 39 min | 5 (+40) |

The cost ratio (G4) is also high: CV-363 is first ridden at +94 min for a 42-min detour (2.2), and AS-227 at 2.8.

**9. major: the pace factor (Next up 1) still holds back JV-7032, Vidrà, Tost and Santa Engràcia,** at 22–25 % fun. For JV-7032 (it has a ref) the Next up 1 fix should be enough. Owner: gis-data-engineer.

**10. minor: G2 "on the overlay" reads `twisties.json`, not the graph's fun.** It reports 100 % for GIV-5221, BV-5114, C-462 and CA-643 while the graph has them at 9–29 %. Fix: report graph fun share (`edgeFunM / edgeLengthM` along the located road) next to it. Owner: routing-engineer.

**11. minor: a renamed or removed road id is never reported as lost.** `diff.ts:184` skips ids missing from the current run. Fix: list ids that are in the baseline but no longer in the list.

**12. minor: the seeds' `addedOn` is 2026-10-14, a day after the commit (2026-10-13).** This will matter once `tunedThrough` is set.

**13. minor: dead-end checks against the real roads.**
- Mare de Déu del Mont ends at the sanctuary; only footpaths go on. Dead end: true.
- Tost ends at the village; only tracks go on. Dead end: true.
- Santa Engràcia continues under the same name as `highway=track`, so for a road bike it is a dead end. True.
- Vidrà–Sant Privat is a through road in reality; see finding 2.

### 3. What works, don't break it

- Matching by exact ref or name, and snapping to the road's own edges, located all 27 roads (9 seeds plus 18 new). Matching by ref alone handles roads whose name changes in villages (CV-35, N-502, C-462).
- The 80 % geometric "ridden" check behaved as intended: its only misses on the scout trips came from bad seed extents.
- Fixed-trip results reproduce exactly (6 of 18), and the 91 trips run in about 10 s.
- Pairs found today: CV-35 ×3, CV-345 Alpuente–Titaguas ×1, CV-363 ×2. All stay found after my corrections.
- Corrections that move extents need a rebaseline commit, because `roadsHash` changes. Renaming ids (cv-35-tuejar-aras, cv-345-villar-north, cv-345-titaguas) requires updating the `roads` arrays in `trips.json` in the same commit; if that is not wanted, keep the old ids and only fix the extents.

### Appendix A. Corrections to the seeds, as data

The entries below are only those that change. Tost, Santa Engràcia and JV-7032 have the right extents and stay as they are; only their `why` needs clarifying:
- **Tost:** from Hostalets de Tost near the C-14 up to the village; only tracks beyond.
- **Santa Engràcia:** from the C-13 at Talarn; it continues as a track.
- **JV-7032:** from Segura de la Sierra to the Los Colladicos junction with the JF-7016 and JF-7012.

```json
[
{ "id": "vidra-sant-privat", "name": "Carretera de Vidrà a Sant Privat d'en Bas", "region": "Osona and Garrotxa", "from": [2.317, 42.1355], "to": [2.4249, 42.15], "why": "22 km narrow through road from Vidrà over to Sant Privat d'en Bas. Graph cuts it at Vidrà: the 100 m link to BV-5227 is highway=residential (w737018081) and dropped, so it plans as an out-and-back (cost 95-154 min). Unclassified: fun 23%.", "trip": { "from": [2.1932, 42.1982], "fromName": "Ripoll", "to": [2.489, 42.1822], "toName": "Olot" }, "addedBy": "routing (ROADMAP Next up 1)", "addedOn": "2026-10-13" },
{ "id": "mare-de-deu-del-mont", "name": "Carretera de la Mare de Déu del Mont", "region": "Alt Empordà", "from": [2.7679, 42.2618], "to": [2.7079, 42.2584], "why": "Climb from the GIP-5237 junction (Sant Martí Sesserres side) to the sanctuary; ends there. Tagged maxspeed=30 throughout: fun 0% from the urban-limit rule, not only the pace factor.", "addedBy": "routing (ROADMAP Next up 1)", "addedOn": "2026-10-13" },
{ "id": "cv-35-tuejar-titaguas", "ref": "CV-35", "region": "Valencia interior", "from": [-1.043, 39.7742], "to": [-1.0835, 39.8631], "why": "CV-35 climbing from Tuéjar to Titaguas; flowing (fun 29%, no overlay twisty). Weakest Valencian entry, kept for the rider's classic.", "trip": { "from": [-0.3763, 39.4699], "fromName": "València", "to": [-1.28005, 40.10779], "toName": "Los Santos (Ademuz)" }, "addedBy": "routing (ROADMAP Next up 2)", "addedOn": "2026-10-13" },
{ "id": "cv-35-titaguas-border", "ref": "CV-35", "region": "Valencia interior", "from": [-1.0835, 39.8631], "to": [-1.2084, 39.9439], "why": "CV-35 from Titaguas past Aras de los Olmos down to the Cuenca border (continues as CM-2203); the curviest CV-35 (56-81% fun past Aras). Split at Titaguas where CV-345 joins.", "trip": { "from": [-0.3763, 39.4699], "fromName": "València", "to": [-1.28005, 40.10779], "toName": "Los Santos (Ademuz)" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "cv-345-villar-alpuente", "ref": "CV-345", "region": "Valencia interior", "from": [-0.8219, 39.7373], "to": [-1.0099, 39.8897], "why": "Villar del Arzobispo - Higueruelas - La Yesa - Alpuente (Twisty). Starts at Villar, not Casinos: the flat 11 km from Casinos made València ride only 77%. Ends at the Alpuente roundabout, whose unnamed edges split the ref.", "trip": { "from": [-0.3763, 39.4699], "fromName": "València", "to": [-1.28005, 40.10779], "toName": "Los Santos (Ademuz)" }, "addedBy": "routing (ROADMAP Next up 2)", "addedOn": "2026-10-13" },
{ "id": "cv-345-alpuente-titaguas", "ref": "CV-345", "region": "Valencia interior", "from": [-1.0101, 39.8897], "to": [-1.0785, 39.863], "why": "Last 8 km of CV-345 from the Alpuente roundabout to the CV-35 at Titaguas; a flowing link of the rider's classic.", "trip": { "from": [-0.3763, 39.4699], "fromName": "València", "to": [-1.28005, 40.10779], "toName": "Los Santos (Ademuz)" }, "addedBy": "routing (ROADMAP Next up 2)", "addedOn": "2026-10-13" },
{ "id": "cv-363-losilla-ademuz", "ref": "CV-363", "region": "Valencia interior", "from": [-1.093, 39.9653], "to": [-1.2453, 40.0559], "why": "CV-363 from the CV-355 junction near Losilla de Aras through Puebla de San Miguel and Val de la Sabina towards Ademuz; Epic. Extended 8 km past the old end, which was a spur.", "trip": { "from": [-0.3763, 39.4699], "fromName": "València", "to": [-1.28005, 40.10779], "toName": "Los Santos (Ademuz)" }, "addedBy": "routing (ROADMAP Next up 2)", "addedOn": "2026-10-13" }
]
```

### Appendix B. 18 new roads

All are through roads, located by the bench as written. Each `why` ends with what that road's scout trip does today: on the fastest route, found at stop N, or missed and why.

```json
[
{ "id": "giv-5221-oix-beget", "ref": "GIV-5221", "region": "Garrotxa", "from": [2.5527, 42.2216], "to": [2.4792, 42.3215], "why": "Castellfollit de la Roca - Oix - Beget, on to GIV-5223 for Camprodon; 27 km of narrow bends, overlay Very twisty. Graph fun 29%: Oix-Beget is maxspeed=30 and zeroed. Today: missed, cost 63 min.", "trip": { "from": [2.489, 42.1822], "fromName": "Olot", "to": [2.3649, 42.3128], "toName": "Camprodon" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "c-462-coll-de-port", "ref": "C-462", "region": "Solsonès", "from": [1.5921, 42.136], "to": [1.568, 42.2303], "why": "Sant Llorenç de Morunys over Coll de Port (1,668 m) to Tuixent; long mountain climb, fun 73%. Today: missed, cost 69 min.", "trip": { "from": [1.5184, 41.9946], "fromName": "Solsona", "to": [1.456, 42.3576], "toName": "la Seu d'Urgell" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "c-462-tuixent-la-seu", "ref": "C-462", "region": "Alt Urgell", "from": [1.568, 42.2303], "to": [1.4558, 42.3529], "why": "Tuixent to la Seu d'Urgell, 38 km of tight narrow bends; overlay Very twisty but graph fun 9% (maxspeed=40, zeroed). Today: missed, cost 65 min.", "trip": { "from": [1.5184, 41.9946], "fromName": "Solsona", "to": [1.456, 42.3576], "toName": "la Seu d'Urgell" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "bv-5114-santa-fe", "ref": "BV-5114", "region": "Montseny", "from": [2.4654, 41.7263], "to": [2.4183, 41.8044], "why": "Campins up to Santa Fe del Montseny and over to the GIV-5201 for Viladrau; the Montseny classic, Very twisty. Graph fun 20% (maxspeed 40/50 zeroed). Today: missed at a 10 min cost; stop 1 rides only 37%.", "trip": { "from": [2.4915, 41.6895], "fromName": "Sant Celoni", "to": [2.3907, 41.8483], "toName": "Viladrau" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "bv-5301-montseny", "ref": "BV-5301", "region": "Montseny", "from": [2.4311, 41.7075], "to": [2.3052, 41.8168], "why": "Sant Esteve de Palautordera - Montseny - Coll Formic - El Brull; Very twisty, fun 78%. Today: missed on Granollers-Vic at a 52 min cost, though found on Sant Celoni-Viladrau.", "trip": { "from": [2.2876, 41.608], "fromName": "Granollers", "to": [2.2546, 41.9302], "toName": "Vic" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "c-28-bonaigua", "ref": "C-28", "region": "Pallars Sobirà and Val d'Aran", "from": [1.1231, 42.6106], "to": [0.9331, 42.6996], "why": "Esterri d'Àneu over the Port de la Bonaigua (2,072 m) to Salardú; high pass with hairpins. Today: missed at a 22 min cost; only 2 stops.", "trip": { "from": [0.9673, 42.2474], "fromName": "la Pobla de Segur", "to": [0.7955, 42.7018], "toName": "Vielha" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "n-260-port-del-canto", "ref": "N-260", "region": "Pallars Sobirà and Alt Urgell", "from": [1.134, 42.4076], "to": [1.3985, 42.326], "why": "Sort over the Port del Cantó (1,725 m) to Adrall; 44 km of sweepers and bends, Very twisty. Today: on the fastest route, found at stop 0.", "trip": { "from": [0.9673, 42.2474], "fromName": "la Pobla de Segur", "to": [1.456, 42.3576], "toName": "la Seu d'Urgell" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "n-621-hermida", "ref": "N-621", "region": "Picos de Europa (Cantabria)", "from": [-4.584, 43.3234], "to": [-4.6234, 43.1537], "why": "Panes through the Desfiladero de La Hermida to Potes; limestone gorge. Today: on the fastest route, found at stop 0.", "trip": { "from": [-4.4003, 43.3832], "fromName": "San Vicente de la Barquera", "to": [-5.0057, 42.9756], "toName": "Riaño" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "n-625-beyos-ponton", "ref": "N-625", "region": "Picos de Europa (Asturias and León)", "from": [-5.1305, 43.3066], "to": [-5.0189, 43.0999], "why": "Cangas de Onís through the Desfiladero de los Beyos and Oseja de Sajambre up to the Puerto del Pontón; Very twisty. León half has 0% graph fun (probably the same posted-limit zeroing, not verified). Today: on the fastest route, found at stop 0.", "trip": { "from": [-4.7531, 43.4211], "fromName": "Llanes", "to": [-5.0057, 42.9756], "toName": "Riaño" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "as-227-somiedo", "ref": "AS-227", "region": "Asturias (Somiedo)", "from": [-6.195, 43.3503], "to": [-6.2363, 43.0481], "why": "AS-227 up the Pigüeña valley to Pola de Somiedo and the Puerto de Somiedo (1,486 m), continuing into León; Twisty. Today: found at stop 4 (+62 min) for a 22 min cost, ratio 2.8.", "trip": { "from": [-5.8448, 43.3603], "fromName": "Oviedo", "to": [-6.3183, 42.9389], "toName": "Villablino" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "ca-643-lunada", "ref": "CA-643", "region": "Cantabria (Valles Pasiegos)", "from": [-3.7062, 43.2254], "to": [-3.6552, 43.1713], "why": "San Roque de Riomiera up to the Puerto de Lunada and on into Burgos; hairpins over open pasture. Graph fun 10% (zeroed). Today: on the fastest route, found at stop 0.", "trip": { "from": [-3.81, 43.4619], "fromName": "Santander", "to": [-3.552, 43.0766], "toName": "Espinosa de los Monteros" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "n-502-puerto-del-pico", "ref": "N-502", "region": "Sierra de Gredos", "from": [-5.0072, 40.296], "to": [-5.0142, 40.3228], "why": "Cuevas del Valle up the hairpins beside the Roman road to the Puerto del Pico (1,352 m). Today: on the fastest route, found at stop 0.", "trip": { "from": [-4.8312, 39.9604], "fromName": "Talavera de la Reina", "to": [-4.7002, 40.6565], "toName": "Ávila" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "a-4132-alpujarra", "ref": "A-4132", "region": "Alpujarras", "from": [-3.4284, 36.9013], "to": [-3.2669, 36.998], "why": "Órgiva - Pampaneira - Pitres - Trevélez along the south face of Sierra Nevada; Very twisty, fun 69%. Today: missed at a 42 min cost; only 3 stops up to +22 min.", "trip": { "from": [-3.4802, 36.9181], "fromName": "Lanjarón", "to": [-3.1803, 36.9462], "toName": "Cádiar" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "a-337-la-ragua", "ref": "A-337", "region": "Sierra Nevada", "from": [-3.0588, 37.1815], "to": [-3.0123, 36.9661], "why": "La Calahorra over the Puerto de la Ragua (2,041 m) down to Cherín near Ugíjar; Very twisty. Today: on the fastest route, found at stop 0.", "trip": { "from": [-3.1373, 37.2991], "fromName": "Guadix", "to": [-2.9469, 36.8467], "toName": "Berja" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "a-397-ronda-san-pedro", "ref": "A-397", "region": "Serranía de Ronda", "from": [-5.1478, 36.7533], "to": [-5.0064, 36.5106], "why": "Ronda down to San Pedro de Alcántara; 44 km of fast, well-surfaced sweepers, Twisty. Today: found on stops 0-5.", "trip": { "from": [-5.9953, 37.3886], "fromName": "Sevilla", "to": [-4.8856, 36.509], "toName": "Marbella" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "ca-9104-palomas", "ref": "CA-9104", "region": "Sierra de Grazalema", "from": [-5.3885, 36.8338], "to": [-5.3822, 36.7614], "why": "Zahara de la Sierra over the Puerto de las Palomas (1,357 m) to Grazalema; steep and tight, fun 91%, Very twisty. Today: missed at a 40 min cost; the planner prefers the A-372 over Boyar.", "trip": { "from": [-5.8063, 36.7505], "fromName": "Arcos de la Frontera", "to": [-5.1666, 36.7421], "toName": "Ronda" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "a-1702-maestrazgo", "ref": "A-1702", "region": "Maestrazgo (Teruel)", "from": [-0.4842, 40.5393], "to": [-0.5515, 40.8433], "why": "From the A-226 near Fortanete through Villarluengo and the Órganos de Montoro to Ejulve and Gargallo; 55 km, fun 61%, Very twisty. Today: missed at a 39 min cost.", "trip": { "from": [-0.13, 41.0507], "fromName": "Alcañiz", "to": [-0.4062, 40.5253], "toName": "Cantavieja" }, "addedBy": "road-scout", "addedOn": "2026-10-13" },
{ "id": "cv-70-confrides", "ref": "CV-70", "region": "Alicante interior (Marina Baixa)", "from": [-0.3922, 38.6998], "to": [-0.2122, 38.6762], "why": "Benilloba - Benasau - Port de Confrides - Guadalest; 23 km, fun 78%, Very twisty. Today: on the fastest route, found at stop 0.", "trip": { "from": [-0.4401, 38.7442], "fromName": "Cocentaina", "to": [-0.0472, 38.6028], "toName": "Altea" }, "addedBy": "road-scout", "addedOn": "2026-10-13" }
]
```

Dropped or left for a later round:
- **A-136 Portalet:** it ends at the French border, which is a dead end in a Spain-only graph.
- **AS-264 Sotres:** in practice a dead end for road bikes.
- **CV-195 Jérica–Zucaina:** a candidate for the next round, but the graph shows a suspicious 22 m gap.
- **No new Valencia-province entries** beyond the rider's classics.

Eight of the new trips put the road on the fastest route. They guard against the pipeline losing the road, not against the planner skipping it.

### Appendix C. Today's 6 of 18, pair by pair

**Found (6):**
- CV-35 on València (stop 2), on the CV-35 generated trip (stop 4) and on the CV-363 generated trip (stop 3).
- CV-345 Alpuente–Titaguas on València (stop 3).
- CV-363 on València (stop 6, at +94 min for a 42-min cost) and on the Titaguas generated trip (stop 8).

**Missed (12):**

| Cause | Pairs | Detail |
| --- | --- | --- |
| Bad seed | 1 | CV-345 north on València: ridden 77 % because of the Casinos start. Fixed above. |
| Pipeline and planner | 2 | JV-7032 on Cazorla→Yeste (41 min): 23 % fun from the pace factor, and only 3 stops. JV-7032 on Nerpio→Daimiel (49 min): the same, plus competition from the 110 km JF-7038. |
| Trips that shouldn't demand it | 9 | Generated trips of 220–338 km, costs 43–89 min, that ride other great roads: CV-20, A-1701, CV-125, CV-390. |
| Not counted at all | — | Vidrà (false dead end in the graph: pipeline connectivity) and the 3 real dead ends (excluded by rule). |

The pace factor in Next up 1 explains only JV-7032 and the zero overlay for Vidrà, Tost and Santa Engràcia. The bigger fun loss comes from the posted-limit rule (finding 1), which Next up 1 does not cover.

Everything is in `<scratchpad>/`:
- `runall/report.md`: today's seeds, 6 of 18
- `runw2/report.md`: corrected seeds, 10 of 23
- `runc2/report.md`: new roads with their scout trips
- `runc3/`: the alternative trips that put a road off the fastest route
- `explore.mjs`, `diag.ts`: my graph and per-stop coverage tools
- `cand.tsv`, `mk.py`: the inputs for the candidates

