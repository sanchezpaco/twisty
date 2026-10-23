Expert-rider release review. Main 5b9590d, data 3311fa55967b0a48. Read-only, no phone, nothing heavy run.

**How I reviewed it.** I read the bench output in `data/review-2026-10-19/bench/` (report, results.jsonl, via.md). I also planned 24 two-point trips plus the 5 via trips with the real `Planner` on main's data, using a scratch bundle. Each plan takes under 1.2 s; the whole run took 4 s. The bench has no Jaca → Benasque trip and none of its outputs name the roads, so I needed my own runs.
- Full output: `<scratchpad>/plan/out.txt`
- Every stop with its twisties: `<scratchpad>/plan/compact.txt`
- My via runs give the same numbers as `5b9590d__via.md`.
- I did not screenshot the UI. The summary findings come from the code (`RideSummary.svelte`, `curves.ts`, `ride.ts`) applied to these plans.

## 1. Scores

- **Road choice: 6.** I would ride 11 of the 17 default stops I judged as they are. The Pyrenees showcase defaults miss the classics: Jaca → Benasque rides lanes instead of Cotefablo, and Pobla de Segur → Vielha rides the Pobleta lane instead of the Bonaigua.
- **Flow: 7.** No default stop rides a road twice or comes back on itself (bench R1/R2: 0 at the default). Two defaults keep leaving the main road and rejoining it a few km on: Madrid → Granada (off and on the A-44 three times) and Ávila → Plasencia (five lane hops off the N-110).
- **Slider: 6.** 14 stops are beaten by another stop at most 5 min dearer that has 15 or more km more of curves; all 14 are coverage stops. Example: great-as-227-somiedo stops 1-4 against stop 5.
- **Times: 6.** On motorway trips the fastest is about +11% (Madrid → Granada 4h39 against Google's ~4h10). On twisty roads it is 25-45% slower than a brisk rider: Cocentaina → Altea fastest 1h12 for 52 km, where I ride about 50 min. Leaving a city centre is optimistic.
- **Trust: 6.** Opened in Google Maps, the Madrid → Granada default rides 28% of its twisty km (bench pinFidelity), and on max curves the median is 61%. Summary labels overstate roads, e.g. "A-319 167 km" when the A-319 is 85.5 km in the graph.

## 2. Findings, most severe first

**No blockers.** I found nothing unsafe: no tracks, one-way roads are respected (the Añisclo canyon is only ridden uphill, as signed), and no road I know to be closed.

**M1. The Madrid → Granada default exists to add a 3 km town crossing (major).**
- Where: fixed-madrid-granada, stop 2 (+42, the default).
- What I see: it is a coverage stop for "A-6026", 3.2 km, which is listed first as "Añadida". In the graph that road is "A-6026 · Acceso Autovía / Avenida de Jaén / Antigua Travesía de Campillo de Arenas", the old road through the village. The rest of the ride is the old N-323 alongside the A-44: JA-3206, back on the A-44, A-6026, N-323A through Iznalloz, GR-3423 (Suave) through Deifontes. Total: 46 km of mostly gentle or flowing curves, and Google Maps keeps 28% of it.
- Same mechanism elsewhere: on great-c-28-bonaigua (Pobla → Vielha), the stop that rides the Bonaigua is headed "Añadida: C-28z · Avinguda del Port de la Bonaigua 4.1 km", which is the street through Esterri d'Àneu. A candidate rated 4 or more is "great" (`planner.ts:465`) with no minimum length and no check for town streets.
- Why it matters: Madrid → Granada is a likely first trip for a Spanish rider, and the default headline is a road nobody knows.
- Direction: a great road needs a minimum length (about 8 km) and must not be a town crossing or street; a coverage stop is labelled by the road it rides most. Owner: routing.

**M2. Twisty labels hide the roads you actually ride and overstate lengths (major).**
- How it happens: a twisty chained across several roads takes the name of its longest piece (`ride.ts:247`). That piece can be the unnamed one.
- In my 29 trips, 150+ twisties of 15 km or more carry a label that covers under 60% of them. Examples:
  - madrid-arenas stop 7: "AV-901 120 km", of which 35 km are AV-901.
  - via-jaca-panticosa-benasque stops 6-8: "N-260a 88 km". It hides HU-631 and the Buerba road, and the Añisclo canyon is not ridden at all, even though the label says "Cañón de Añisclo".
  - València → Los Santos, all stops: "CV-35 30 km" is 10 km of CV-35 plus CM-2203, CM-2251 and N-330a.
  - via-alcaniz stop 8: "A-1702 73 km", of which A-2403 is 26 km and TE-70 18 km.
  - malaga-ronda stops 6-8: "Carretera sin nombre 40-53 km", although MA-5403, MA-4401 and MA-4402 are named.
  - bench great-jv-7032-segura stop 5: "JF-7038 89 km", while the whole JF-7038 is 42.6 km.
- Why it matters: the rider checks the refs against the signs and the map, and they do not match.
- Direction: list the roads of a chained twisty in order (or split it at road changes of 5 km or more). Never prefer the unnamed road over named ones. Never show more km for a road than the road has. Owner: routing (`ride.ts`), with frontend for the display.

**M3. The Pyrenees showcase defaults miss the classics (major; instances of the known undervaluation of flowing classics).**
- Jaca → Benasque, default stop 2 (+39):
  - From Aínsa it loops north on HF04, SC-22907-01 and SC-22109-01 (narrow over 7.5 of 7.6 km, signed 40) and comes back to the N-260 8 km on.
  - After Castejón de Sos it climbs the Carretera de Liri and SC-22221-03 Arasán instead of the A-139.
  - The old N-260a over Cotefablo (Biescas → Broto, worth about 20 min) is in none of the 9 stops; it only appears when Panticosa is added as a stop.
- great-c-28-bonaigua (Pobla de Segur → Vielha), default stop 3 (+40):
  - It rides the Pobleta de Bellveí – Gerri de la Sal lane, while Collegats plus the Bonaigua sits at stop 2 (+29).
  - The Bonaigua stop exists only because of the Esterri street (M1).
- Why it matters: every Pyrenean rider knows these two routes and will judge the app on them.
- Direction: report only, no tuning to these trips. road-scout adds N-260a Cotefablo to the great-roads set, and the bench flags a default that drops a demanded classic for lanes. Owner: road-scout, then routing.

**M4. Max curves often means council lanes instead of the classic (major; instances only).**
- llanes-riano max: LLN-7, LLN-14, CO-3, PI-13, "Carretera de Tendi a Pandavenes", AM-1, then the Beyos. No Mirador del Fito (AS-260) or Ponga.
- oviedo-villablino max: GR-2, GR-5 and BE-1 lanes replace the Puerto de San Lorenzo (AS-265), which the default does ride.
- madrid-arenas max: only 3 km of N-502, so no Puerto del Pico; it takes the AV-P-711/712/713 lanes instead.
- malaga-ronda max: lanes through Valle de Abdalajís, shown as "sin nombre".
- solsona-laseu max: leaves the C-462 at Tuixent for the La Vansa and Sorribes lanes.
- Direction: as M3. Owner: routing.

**M5. Google Maps does not follow many plans (major for the PRD's ≥90% goal).**
- At the default stop the median is 0.97, but 10 of 127 trips are under 0.5: regional-012 and regional-013 at 0.03, fixed-madrid-granada at 0.28.
- At the max stop the median is 0.61, with 39 of 127 under 0.5.
- The GPX advice covers riders who read it. A Google Maps rider gets another ride.
- Direction: when a twisty runs beside an autovía, add pins inside it or keep it out of the default; otherwise say that this option is GPX only. Owner: routing (`googleMaps.ts`).

**M6. Defaults that buy short lanes (major for the two-point trips; the loop case is not a launch blocker).**
- avila-plasencia default (+28): five hops off and back onto the N-110 (AV-P-517, AV-P-520, AV-P-659, AV-P-662, AV-P-541, each 3-9 km). The Puerto de Honduras (CC-224) sits at +48.
- santander-potes default (+43): coastal lanes CA-322, CA-353 and CA-131 through Santillana and Comillas. The Cabuérniga (CA-182) and Puentenansa route is at +30.
- via-valencia-loop default (+33): 27 km of short pieces (A-2521, CV-2391, CV-218), all on the way back. Not a launch blocker: the CV-35 is one notch up, at +65.
- Direction: file these under the fun-model item that already holds the loop case. Owner: routing.

**m1. Coverage stops crowd the slider (minor).**
- great-as-227-somiedo: four coverage stops (AS-354 +13, MO-3 +16, MO-2 +22, AS-231 +25), each worth 21-34 km of curves, then stop 5 (+26) with 57 km.
- zaragoza-ainsa: the max stop (+161, 290 km) buys 4 km more of curves than stop 7 (+102), on a detour west via Cinco Villas and Sos.
- Direction: drop a coverage stop that another stop within 5 min clearly beats. Owner: routing.

**m2. City exits and town centres are optimistic (minor; instances of the known town speeds).**
- Madrid, Sol → A-6: Calle de Segovia, Paseo de la Virgen del Puerto and Avenida de Valladolid at 80 km/h; 4.7 km in 5 min where I'd need 10-12.
- regional-017 default crosses 7.1 km of Reus centre.
- Max stops cross Jaén centre: cross-012 7.1 km, cross-015 8 km, tracks-002 10.7 km, via A-6050, J-222a and JA-3200.
- Owner: routing.

**m3. Twisty roads are timed too slowly (minor).**
- Examples: HU-631 / Buerba at 28-29 km/h, CV-363 Casas Altas at 25, MA-3101 at 27, Vall del Bac at 27-30.
- The effect: on the twistiest stops the "+X min" figure overstates the real extra by roughly a third. Llanes → Riaño max says 4h19; I'd ride it in about 3h30.
- My call: publishable, because it errs safe. I am not proposing tuning to the one ride.

**m4. Odd posted-limit chips (minor).**
- The N-260 over the Coll de Perves (pobla-vielha fastest) shows "Limitada a 20 km/h": OSM has maxspeed=20 on 6.8 km and 30 on 11.7 km.
- M-507 in madrid-arenas also shows 20.
- Direction: verify the OSM tags; consider a floor below which the chip says "check the signs". Owner: gis-data-engineer.

## 3. What works, don't break it

Many defaults are the ride I'd choose myself:
- sevilla-marbella: Grazalema A-372, then A-374, then A-397 Ronda – San Pedro.
- granada-ugijar: GR-3201, then La Ragua (A-337).
- oviedo-villablino: San Lorenzo (AS-265), then Somiedo (AS-227).
- llanes-riano: CA-282 Lamasón, La Hermida, then San Glorio.
- bilbao-potes: CA-182 and CA-282.
- madrid-segovia: Navacerrada.
- zaragoza-ainsa: A-1604 Laguarta.
- valencia-morella: CV-166 Culla and Benassal.
- malaga-ronda: A-366 Puerto del Viento.
- València → Los Santos: CV-345 then CV-35.
- madrid-arenas: AV-922.

Max stops that are superb: Valencia → Cuenca (Tormón, Huélamo, Uña), Valencia → Morella (Espadà, Puertomingalvo, Portell), Alicante → Alcoi (Aigües, Relleu, Sella), Ávila → Plasencia (La Vera), Bilbao → Potes (Asón, Lunada, Pas), Barcelona → Ripoll (B-124 Sant Llorenç Savall).

Also keep:
- The fastest route is right: the new N-260 Petralba tunnels on Jaca → Benasque.
- Trips under 15 min keep their stops hidden: València → Ciutat de les Arts i les Ciències does not default to a 46-min detour.
- The Añisclo one-way is respected.
- Stops are clearly distinct on most trips.

## Launch readiness from a rider's view

A Spanish rider who plans in Andalucía, Valencia/Teruel, Asturias/Cantabria or Gredos will mostly trust and enjoy the defaults. The times are on the safe side, and I found nothing dangerous or absurd.

What would embarrass the launch is the presentation more than the routing:
- the Madrid → Granada default led by a 3 km village crossing (M1);
- labels like "AV-901 120 km" or "N-260a 88 km" that don't match the road signs (M2);
- Google Maps quietly dropping most of some plans (M5).
M1 and M2 look cheap to fix and I would fix them before release.

The Pyrenees taste gaps (M3, M4) belong to the known fun-model work and can follow in an update. I would still put Cotefablo and the Bonaigua in the validation set now.

