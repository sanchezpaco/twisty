# Weekend rider, review round 2 — 2026-10-14

## Weekend rider, review round 2 (first-time use)

I tested `~/code/twisty-editor` at 22a9e70 (the full-screen search and options chip commits on top of f9ca9d9). I built it with `npx vite build`, served it with `vite preview --port 4331`, and stopped the server when I was done. I used headless Chrome through puppeteer-core at 360×780, dpr 3, with touch emulation and a fake location in València. I ran one fresh launch in Spanish and one in English, in a clean browser context. I didn't touch adb or the repo.

Screenshots are in `<scratchpad>/rider2/`; shot names below refer to that folder.

Trips:
- **Sunday ride:** València → Chelva.
- **Second trip:** Mi ubicación → Alcoi.
- **Short trips:** Mi ubicación → Serra, and a long press on the map to set Marines.
- **English:** My location → Morella.
- I also opened the Chelva route in Google Maps (web).

### 1. Scores

| Criterion | Score | Evidence |
| --- | --- | --- |
| Understanding | 8 | `03-launch-9s.png`: Spain framed above the sheet. The intro copy explains A, B and "con el deslizador decides cuántos minutos cambias por curvas" before I ever see the slider. The legend "Suave → Épica" is clear. |
| Stuck moments | 6 | Three real "huh?" moments. The slider can't move on Marines but the copy says "Desliza a la derecha" (`45-B-from-map-4s.png`). A blank black page after picking a place (`08-after-A-3s.png`). The bars disappear after scrolling (`18-bar6-1.75s.png`). Smaller ones: badge "1" missing, unselected bars in two colours I couldn't decode. |
| First route | 9 | About 15 s from launch to a route, typing included. The route is drawn 0.3 s after picking Chelva (`10-picked-B-0.3s.png`). Planning took 224 ms for Alcoi and 104 ms for Morella. The default Chelva route takes CV-379 Chiva–Gestalgar, which my group actually rides. |
| Hand-off | 8 | The line "Cada tramo lleva puntos de paso para que Google Maps lo recorra entero" builds trust (`14-sheet-bottom.png`). Google shows 1 h 35 / 90.7 km against Twisty's 1 h 29 / 88 km, same shape and same roads (`32-gmaps-map.png`). Google still lists raw coordinates for the stops (`31-gmaps.png`). |
| Would recommend | 8 | Chelva via Gestalgar and Alcoi via Agres (`53-row1-2.6s.png`) are rides I'd post in the group chat. The dent: a short Calderona trip offered no curvy option at all. |

### 2. Findings (stuck moments, most severe first)

1. **Major: on a trip with only the fastest option, the slider is frozen but tells me to slide.**
   - What I tried: long press → "Llegar aquí" near Marines, 24 min from València.
   - What I expected: a curvy alternative, or a clear "nothing worth it here".
   - What happened: a lone thumb on an empty track. The input has `max=0`. The hint "El camino más rápido. Desliza a la derecha para cambiar minutos por curvas." sits at y=830, below the visible sheet, and it's false here anyway.
   - Evidence: `45-B-from-map-4s.png`, `46-marines-slide.png`.
   - Fix: when there's one option, hide the slider and bars and show a line in place, for example "En este trayecto no hay curvas que compensen el rodeo; prueba un destino más lejos." Add a separate i18n key in `en.ts`/`es.ts`.
   - Owner: `app` (copy from `ux-designer`).
   - Related, owner `routing`/`road-scout`: Serra–Olocau–Marines is a classic Calderona loop, and the CV-328 Náquera–Serra (Muy revirada) was offered on the Serra trip right next door. Check whether short trips are capped out of any detour.

2. **Major: after picking a place in the full-screen search, I'm left on an empty black page.**
   - What I tried: picked València for A.
   - What I expected: the cursor jumps to B, or the map shows A.
   - What happened: nothing has focus (`activeElement = BODY`), so the "Chelva" I typed straight away was lost. There's no map, just two fields on black. The same thing happens when B is set first and A is empty (`62-en-after-B.png`).
   - Evidence: `06-picked-A.png`, `08-after-A-3s.png`.
   - Fix: after a pick, focus the other field if it's empty; if both are set, close the search and show the route.
   - Owner: `app`.

3. **Major: the trade-off bars stay hidden after scrolling the sheet at full height and lowering it.**
   - What I tried: scrolled the full sheet down to the GPX button, then dragged the sheet to half.
   - What I expected: the slider with its bars.
   - What happened: the bars stayed scrolled under the header. Tapping where they should be did nothing. Swiping can't bring them back because at half height `.body` is `overflow: hidden` with `scrollTop` stuck at 80.
   - Evidence: `18-bar6-1.75s.png`, `20-swipe-down-content.png`.
   - I set that scroll programmatically at full height, which is the same end state a finger scroll leaves.
   - Fix: reset the sheet body's `scrollTop` to 0 whenever it snaps below full.
   - Owner: `app`.

4. **Minor: badge "1" is dropped in the route overview when it sits near badge "2".**
   - What I saw: a "2" with no "1", on Alcoi and on Morella. It only appears after flying to the road.
   - Evidence: `50-alcoy.png`, `63-en-route.png`, `53-row1-2.6s.png`.
   - Fix: numbered badges are never dropped by collision; offset or shrink them instead.
   - Owner: `cartographer` → `app`.

5. **Minor (still there from round 1): map labels and pins show through the sheet.**
   - What I saw: "Castelló de la Plana / Castellón" in bold behind the bar chart, "Alacant / Alicante" next to "1 h 57", and a ghost A pin behind the "Resto" card.
   - Evidence: `64-en-full.png`, `50-alcoy.png`, `14-sheet-bottom.png`.
   - Fix: sheet surface opacity of about 0.94, or a backdrop blur that actually ends up in the built CSS (round-1 item A5).
   - Owner: `app`.

6. **Minor: with only two options, the chart is one huge orange block next to an empty bar.** It looks like a rendering glitch, not a choice.
   - Evidence: `41-serra-3.4s.png`.
   - Fix: give bars a maximum width per stop, or centre a fixed-width pair.
   - Owner: `ux-designer` → `app`.

7. **Minor: I can't tell what the two colours in the unselected bars mean.** They're muted teal over sand; only the selected bar uses the legend colours.
   - Evidence: `12-picked-B-4s.png`.
   - Fix: draw unselected bars in the rating colours at lower opacity. Also, the "Curvas" card dot is red while its curves are cyan and yellow; use the rating colours there too.
   - Owner: `ux-designer`.

8. **Minor (still there from round 1): Google shows coordinates instead of place names.**
   - What I saw: "39.4699000, -0.3763000" as the start. Starting from a town centroid also made Google hook to a motorway first ("Via AP-7", +2.7 km).
   - Evidence: `31-gmaps.png`, `32-gmaps-map.png`.
   - Fix: send origin and destination as names when they come from the place index, and keep coordinates for the waypoints. Snap town centroids to a routable main road.
   - Owner: `routing`.

9. **Minor: the long-press menu isn't kept on screen.**
   - What I saw: pressing near the left edge puts it at x=-26, so the A/B dots are cut off and it covers the legend. No pin marks where I pressed.
   - Evidence: `43-longpress-released.png`.
   - Fix: keep the menu inside the viewport and drop a temporary pin at the pressed point.
   - Owner: `app`.

10. **Minor: "my location" is only an unlabelled crosshair, and tapping it while editing B drops my B edit.**
    - What I saw: the empty A page has no "Usar mi ubicación" row. I had opened the search to change B; tapping the crosshair set A and planned straight back to the old Chelva.
    - Evidence: `04-tap-A.png`, `37-myloc-0.4s.png`.
    - Fix: make "Usar mi ubicación" the first suggestion row of an empty A, and keep the search open if the other field was being edited.
    - Owner: `app`.

11. **Minor (still there from round 1): search hints and ranking.**
    - "Chelva · cerca de Utiel" and "Morella · near Cantavieja" (a town in Teruel) read wrong to a local.
    - "Guadale" ranks Guadalest third, behind hamlets 307 km and 544 km away; "Guadal" doesn't show it in the top 8 at all.
    - Evidence: `09-type-Chelva.png`, `55-guadal.png`.
    - Fix: anchor to the comarca capital or the nearest larger town in the same province, and weight distance from A in prefix ranking.
    - Owner: `routing`/GIS.

12. **Minor: after the route settles, B sits against the left edge** (about 30 px). In peek, the lower half of the map is empty and the camera doesn't use it.
    - Evidence: `12-picked-B-4s.png`, `15-sheet-down.png`.
    - Fix: refit with the padded rectangle on each snap change.
    - Owner: `app`.

13. **Minor: in English, "Twisty" is both the app name and a road rating** ("9.3 km · Twisty").
    - Evidence: `64-en-full.png`.
    - Fix: rename the rating in `en.ts`, for example "Tight" or "Twisting".
    - Owner: `ux-designer`.

### Round-1 stuck moments

**Gone:**
- Spain framed under the sheet, and the route hidden by it.
- Trip lost when the app is reloaded. It comes back in 1.5 s, slider stop included: `33-reload-1.5s.png`, stop 5 kept.
- Long-press menu closing on release.
- "Right-click" copy; it now says "Mantén pulsado".
- Slider row jumping.
- Stat cards overflowing at 360.
- Distance measured from the map centre; it's now from A, "a 58 km".
- Route drawn in one colour without a legend. It's now coloured by rating, numbered, and matches the list.
- Whole route redrawn on every slider step; now only the difference animates, in under 0.2 s.
- Suggestions falling under the keyboard; now a full-screen search.
- Back/Escape leaving unpicked text; it now restores Alcoi.
- "Incluir pistas" in the main flow; now behind the Opciones chip, with the clear subtitle "Grava y tierra, para motos trail".
- Locate, swap and clear are now 44 px.

**Remaining:** see-through sheet (5), coordinates in Google (8), search proximity and "near X" (11), badge collisions (4).

**New:** blank page after picking (2), frozen single-option slider (1), sheet scroll stuck (3), two-bar chart (6), long-press menu clamping (9), my-location dropping my B edit (10).

### 3. What I loved, don't break it

- The launch copy explains the whole idea in two sentences before I touch anything.
- Getting from typing to a coloured route takes under a quarter of a second. The default stop for Chelva is the one my group actually rides.
- The route coloured by rating, numbered badges that match the list, and tapping a row to fly to the road with peaks labelled (`53-row1-2.6s.png`).
- Tapping a bar redraws only what changed. "La más rápida" and "+40 min / +26 km de curvas" read at a glance.
- Tapping a place name in the trip card reopens the search with that name selected.
- "Alcoi / Alcoy" bilingual names, and distances from A in the suggestions.
- Trip and stop survive a reload.
- The waypoint line above "Abrir en Google Maps", and Google following the same roads within 3 km.
- The Spanish and English copy both sound natural ("Revirada", "Fluida", "mostly flowing", "Curvy roads on this ride").

