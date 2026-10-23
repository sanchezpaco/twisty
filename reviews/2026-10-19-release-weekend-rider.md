I'm a Sunday rider and Twisty is new to me. Most of the walkthrough is from your shot set (main 5b9590d), on the Huawei size (360x780), in Spanish first and then a glance at English. I also served the built app (`app/dist`) once and timed a first route in headless Chrome. The server is stopped and nothing in the repo was touched. Your brief swaps trips A and B: in the shots, A is Jaca → Benasque and B is València → Los Santos de Maimona. I use the shots' names.

**Your five questions, short answers**
1. **First 30 seconds:** yes. The coloured roads over Spain plus "¿Por dónde rodamos?" tell me what the app is for, and A/B are the obvious first tap. From a cold launch I had "Abrir en..." on screen in 9.4 s (desktop headless Chrome, so a real phone will be slower but still well under 30 s). Shot: `<scratchpad>/first-route.png`
2. **Slider and summary:** the slider ends and the "+39 min / +31 km de curvas" chip I get. The bar chart, the numbered circles, "+ Añadida" and the three middle curve names I don't. "Autovía 78 km" made me doubt the numbers.
3. **Open in..., share, saving:** saving and folders are clear. The Google Maps advice contradicts itself (finding 2). Share showed its toast fine.
4. **Where I lost trust:** "Autovía 78 km" on Jaca → Benasque, and the Google Maps messages that disagree. Nothing looked slow.
5. **What I missed:** nothing that would make me uninstall. I did look for a toll option ("¿con peajes?") and an easy "back home" loop; the loop only works by adding stops.

**Scores**
- **Understanding: 8.** The intro copy and legend make the purpose clear in seconds (`01-first-launch-huawei-es.png`).
- **Stuck moments: 5.** I wondered what the bar heights mean, what the circles 1-5 are, what "+ Añadida" means, and why "Autovía" shows 78 km (`07-slider-huawei-es.png`, `08-summary-scrolled-huawei-es.png`).
- **First route: 9.** Offline town search is instant and "Jac" gives Jaca first; launch to "Abrir en..." took 9.4 s (desktop measure).
- **Hand-off: 5.** The ride screen says Google will ride every stretch, then the sheet says Google may change my route and recommends GPX apps it never names (`07` vs `09-open-in-huawei-es.png`).
- **Would recommend: 7.** The routes look like ones I would really ride (Cañón de Añisclo, N-260), and the summary is honest about speed limits.

**Findings, most severe first** (no blockers)

1. **major: "Autovía 78 km" on Jaca → Benasque**
   - Shot: `08-summary-scrolled-huawei-es.png` (EN shows "Motorway 78 km").
   - What happened to me: I know that road. Apart from the Jaca-Sabiñánigo stretch it is the N-260, a national road. Seeing 78 km of autovía on a Pyrenees ride made me doubt every other number.
   - Cause: the "Autovía" box adds up both motorway and trunk roads (`app/src/lib/routing/ride.ts:77`, `FAST_ROAD_CLASSES = Motorway + Trunk`). The label is `app/src/lib/i18n/es.ts:154`.
   - What would have helped: rename the box to something that covers both, e.g. "Autovía y nacional" or "Vías rápidas", or split motorway and trunk.
   - Owners: app (label) and routing (if it is split).

2. **major: the Google Maps messages contradict each other**
   - Shots: `05-ride-A-default-huawei-es.png`, `07-slider-huawei-es.png`, `09-open-in-huawei-es.png`.
   - What happened to me:
     - The very first ride I see (the default option) warns "Google Maps puede saltarse algún tramo de esta ruta; el GPX sigue la línea entera" before I know what a GPX is.
     - Move the slider and it says the opposite: "Cada tramo lleva puntos de paso para que Google Maps lo recorra entero".
     - Then the sheet always says "Google Maps puede cambiarte la ruta; recomendamos apps que lean el GPX", even when every stretch is pinned, and never names one such app.
   - Result: I don't know if Google Maps will follow the route, and I'm told to use an app I don't have.
   - What would have helped:
     - Show the "recommend GPX" advice only when stretches are really skipped (`es.ts:188` is shown unconditionally).
     - Name the apps; the copy already does elsewhere ("Wikiloc, OsmAnd o tu GPS", `es.ts:173`).
     - Say which stretch Google would skip.
     - Or make the default option fully pinned, so a newcomer's first screen says "Google Maps la recorre entera".
   - Owners: app (copy and conditions), routing (pinning of the default option).

3. **major: the bar chart above the slider has no axis or labels**
   - Shots: `05-ride-A-default-huawei-es.png`, `16-ride-B-huawei-es.png`.
   - What happened to me: nine stacked coloured bars. I guessed colour = kind of curve, but couldn't tell whether height is time, km or curves. On trip B the first bar is an empty grey stub, which looks broken.
   - What would have helped: one caption line, e.g. "Cada barra es una opción: altura = tiempo, colores = curvas". Or the time under the first and last bar. Or say tapping a bar picks it, if it does.
   - Owner: app.

4. **major: the default option on a long trip is a bad deal**
   - Shot: `16-ride-B-huawei-es.png`.
   - What happened to me: València → Los Santos de Maimona opens on "+31 min / +8,7 km de curvas". Half an hour for 9 km of bends on a 651 km day makes the whole idea look poor on my first try.
   - What would have helped: on long trips, open on an option whose trade looks worth it, or show km of curves per extra hour so I can judge.
   - Owner: routing.

5. **minor: the numbered circles on the map are not explained, and the list is out of order**
   - Shots: `05-ride-A-default-huawei-es.png`, `08-summary-scrolled-huawei-es.png`.
   - What happened to me: circles 1-5 appear on the map with no hint. When I scroll, the list reads 2, 1, 3; the added road goes first by design (`ride.ts:151`), which breaks the riding order I expected.
   - What would have helped: list in riding order and mark the added road in place, plus a short heading like "Tramos de curvas (números en el mapa)".
   - Owner: app.

6. **minor: "+ Añadida" means nothing on a phone**
   - Shot: `08-summary-scrolled-huawei-es.png`.
   - What happened to me: its meaning ("Esta opción añade …") lives only in a hover `title` (`app/src/components/RideSummary.svelte:101`), and a phone has no hover.
   - What would have helped: visible words, e.g. "Desvío por curvas".
   - Owner: app.

7. **minor: the legend names only the two ends**
   - Shots: `01-first-launch-huawei-es.png`, `08-summary-scrolled-huawei-es.png`.
   - What happened to me: the legend shows five colours but names only Suave and Épica. Fluida, Revirada and Muy revirada (`es.ts:157`) turn up in the summary with no key. The words themselves are good rider Spanish.
   - What would have helped: the five names in or under the legend, or a tap on the legend that shows them, made obvious.
   - Owner: app.

8. **minor: stops are not named on the ride screen**
   - Shots: `17-ride-C-huawei-es.png`, `18-ride-D-loop-huawei-es.png`.
   - What happened to me: the header reads "València •→ Segorbe", so Teruel never appears. The loop reads "València •→ València", and I couldn't find the Segorbe stop on the map in 18.
   - What would have helped: "València → Segorbe · por Teruel", or "1 parada".
   - Owner: app.

9. **minor: town suggestions point at places I don't know**
   - Shot: `03-town-search-huawei-es.png`.
   - What happened to me: subtitles say "Aldea cerca de Irurozqui" or "cerca de Ventanicas-El Cantal" with no province, and Jaca itself just says "Población". The street result does say "Jaca, Huesca" (`04-street-search-huawei-es.png`).
   - What would have helped: add the province, e.g. "Aldea · Navarra".
   - Owners: routing (search index), app (display).

10. **minor: the satellite credit is in English on the Spanish screen**
    - Shot: `15-satellite-huawei-es.png`.
    - What happened to me: "contains modified Copernicus Sentinel data" sits in a banner that also covers the "Huesca" label.
    - What would have helped: translate it if the licence allows, and tuck it behind the (i) button.
    - Owner: app (the cartographer may want a look).

11. **minor: Arabic labels on the first screen**
    - Shot: `01-first-launch-huawei-es.png`.
    - What happened to me: "Alger الجزائر", "Oran وهران" and Casablanca's Arabic name are the first thing I see. It reads as a foreign app.
    - What would have helped: use Latin-script or Spanish names (`name:es`) for places outside Spain on the base map.
    - Owner: app (map style).

12. **minor: "Usar siempre esta app" gives no way back**
    - Shot: `09-open-in-huawei-es.png`.
    - What happened to me: I wouldn't tick it, because nothing says how to undo it.
    - What would have helped: "(puedes cambiarlo en …)".
    - Owner: app.

13. **minor: jargon on the main screens**
    - What happened to me: "deslizador" in the intro (`es.ts:48`) and "GPX" on the ride screen are tech words. Most Sunday riders don't know what a GPX is.
    - What would have helped: "la barra" or "el control", and a few words on what a GPX is the first time it appears.
    - Owner: app.

14. **minor, not checked: the fastest time may not match Google's**
    - Shot: `16-ride-B-huawei-es.png`.
    - What happened to me: 651 km, with a fastest option of about 7 h 18 (7 h 49 minus 31 min). My guess is Google Maps shows a different ETA for that trip; I did not check it live.
    - What would have helped: if Twisty's times are deliberately slower (for a motorbike), say so in one line, so I don't distrust the app when Google opens with another time.
    - Owner: routing.

**What works, don't break it**
- The first screen: coloured overlay, legend and the "¿Por dónde rodamos?" copy explain the app in one look.
- Offline town search: instant, right first result, "Salir desde mi ubicación" offered first.
- The big time, km and "+X min / +Y km de curvas" chip.
- Real road names (HU-631 Carretera del Cañón de Añisclo, N-260 Eje Pirenaico).
- The "Limitada a 30 km/h" chips and the "Respeta las señales" note: honest and good for safety.
- The Palma error: plain words plus "Cambiar esta parada".
- Saving: default name, simple folders, a mini route drawing, "Hoy · 2 h 57 · 61 km de curvas".
- Dark, Light and Satellite all look good. The Spanish copy sounds like a rider talking ("revirada", "tira de autovía").

**Would I keep it?** Yes. In the first minute it gave me a Pyrenees route through Añisclo that I would really ride.
**Would I recommend it?** Yes, with a caveat: once the "Autovía" number and the Google Maps messages are fixed. Today my riding group would ask "¿78 km de autovía a Benasque?" and "¿pero Google lo sigue o no?".
**What I'd tell a friend:** "Pon salida y llegada, mueve la barra hacia 'más curvas' y te mete por las carreteras buenas; mira que Google no te la cambie."

Shots are in `data/review-2026-10-19/`. My timing shots are `<scratchpad>/first-route.png` and `<scratchpad>/first-route-settled.png`.
