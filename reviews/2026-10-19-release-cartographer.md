Cartographer review: release round, step 1. I looked at main 5b9590d: the shot set in data/review-2026-10-19/, plus my own headless shots of main's `app/dist` at Huawei size (360x780). Those cover the attribution at load and opened, z9 to about z12.5 on Jaca to Benasque, and 3D. The preview server is stopped. One naming note: index.md calls Jaca to Benasque "Trip A" and València to Los Santos "Trip B", the reverse of your brief. I cite file names.

My shots are in <scratchpad>/shots/: `c-attrib-open.png`, `d-zoom-1.png` to `d-zoom-8.png`, `e-3d.png`. The folder also holds a few files I did not make (`a-only-start`, `b-planning-*`, `c-planned`); ignore those.

## Scores
- **Route as hero: 8.** The white transit line is 16:1 on the dark land. Twisty stretches have a glow and casing, and the badges read at every zoom (06-ride-A-max-curves-huawei-en, d-zoom-8). At z6 the stepped-back overlay turns to confetti around the route (16-ride-B-huawei-en), but the route still leads.
- **Legibility, Dark: 6.** Labels are fine (5.3:1), but base roads almost vanish: primary 1.38:1, secondary 1.2:1, minor 1.1:1 against land #0b0e14; water against land is 1.04:1 (theme.ts:48-53). In sunlight nothing but the overlay shows (d-zoom-4, d-zoom-8).
- **Legibility, Light: 8.** Roads 1.5 to 2.1:1, the navy edge plus white rim holds every rating, and the gentle hillshade keeps it clean (14-light-fold-open-en).
- **Legibility, Satellite: 8.** The white band plus dark rim holds the route on forest and cereal (15-satellite-huawei-en). One flaw: the imagery credit pill lets the "Huesca" label show through.
- **Curve colour ramp: 8.** Ordered cool to hot, and it is tested for every type of colour blindness and on every surface (theme.test.ts:163-182). At the Spain view, epic pink is drowned by orange, which comes from the data, not the ramp.
- **Labels: 6.** A or B pins sit on top of the city's own label in 3 of the 4 city trips. Bilingual and Arabic names run long (`Castelló de la Plana / Castellón de la Plana` wraps to 3 lines; `Alger الجزائر`, `/ Iruña`). Density per zoom is good.
- **Relief: 8.** The dark hillshade (0.55, blue highlight) gives depth in the Pyrenees without hiding the overlay. Light is gentle. Satellite correctly has none. 3D reads (e-3d).
- **Consistency: 8.** One rating colour is used across overlay, route, badge halo and the summary chip. The deeper Light ramp is deliberate and documented (theme.ts:15-18).
- **Attribution: 3.** At load it is folded into the compact "i" on purpose (MapView.svelte:333-339, `collapseAttribution`). Opened, it is 3 lines over the foot of the route (c-attrib-open). The OSM text reads "Data from OpenStreetMap", with no ©.

## Findings, most severe first

1. **Blocker. Attribution is folded away at load.** Shot: `c-attrib-open.png` (mine); all 01/05/16 shots show only the "i".
   - **What is wrong:** OSM, OpenMapTiles and OpenFreeMap credits are not visible without a tap, which breaks the OSMF guideline.
   - **Fix:** a permanent one-line credit at the map foot in every theme, not the 5-second collapse. My answer to data policy is below.
   - **Owner:** app.

2. **Major. Dark base roads and water are invisible in sunlight.** Shots: d-zoom-4, d-zoom-8, 05-ride-A-default-huawei-en.
   - **What is wrong:** at z10 to z12.5 a rider cannot see how a twisty connects to the network. Reservoirs disappear.
   - **Fix:** in `MAP_COLORS` (theme.ts:40-57):
     - motorway `#4a556e` (2.6:1)
     - primary `#3a4358` (1.95:1)
     - secondary `#2b3243` (1.5:1)
     - minor `#1f2532` (1.26:1)
     - water `#0a1a30` (navy: separated by hue, not lightness)
     - waterLine `#1a3352`

     They stay neutral grey, so the "road colour clear of every rating" test holds. The "dark theme as it was" fixture (theme.test.ts:79) needs updating.
   - **Owner:** app.

3. **Major. The A or B pin eats the start or finish city's label (your item d, confirmed).** Shots: 16-ride-B-huawei-en ("V●ia"), 18-ride-D-loop-huawei-es, 19-leg-error-huawei-en, 17-ride-C-fold-open-en.
   - **What is wrong:** the pins are DOM markers, which MapLibre's label collision ignores. Half a label is worse than none. It shows in nearly every city trip and will be in the store screenshots.
   - **Fix:** add a symbol layer of invisible pin-sized icons at A and B, above the place layers (`icon-allow-overlap: true`, `icon-ignore-placement: false`). The map then drops the label underneath. The stops' labels already do this; Teruel is clean in 17.
   - **Owner:** app.

4. **Minor. Bilingual and non-Latin place names are long (your item f, confirmed, but it is a label problem, not an edge problem).** Shots: 18-ride-D-loop-huawei-es (Castelló, 3 lines, cut), 19-leg-error-huawei-en (`/ Iruña`), 01-first-launch-huawei-en (`Alger الجزائر`, `Oran وهران`, Casablanca cut).
   - **What is wrong:** being cut at the screen edge is normal for any map; the problem is that these names wrap to 3 lines. The Arabic names also pull the eye to Africa, where the app has nothing.
   - **Fix:** in the `text-field` of the place layers (style.ts:182, 192, 202), keep the part before " / " with `index-of` and `slice`, and fall back to `name:latin`. The offline place index keeps the full name for search.
   - **Owner:** app.

5. **Minor. The leg-error frame cuts off the failing stop (your third item, confirmed).** Shot: 19-leg-error-huawei-en.
   - **What is wrong:** Palma sits on the right edge with its label cut ("Pal"), yet it is the subject of the error. Meanwhile half the frame is empty sea.
   - **Fix:** when a leg fails, fit the camera to the failed stop and its neighbours, with extra padding on the side its label is drawn (about 80 px).
   - **Owner:** app.

6. **Minor. Map labels show through the satellite credit pill.** Shot: 15-satellite-huawei-en ("Huesca" behind the Sentinel pill).
   - **Fix:** make the pill background at least 0.9 opaque. Folded into the permanent credit line from finding 1, this goes away too.
   - **Owner:** app.

## Attribution: what I recommend to data policy
Use a **permanent one-line credit**, not the collapse after 5 seconds or on interaction.
- **Content:** `© OpenStreetMap · © OpenMapTiles · OpenFreeMap`, 10 px, muted colour (`--text-muted`) on an opaque dark pill.
- **Place:** bottom-left of the map, above the phone sheet, left of the "i". It is about 230 px wide, which fits the roughly 312 px free on a 360 px phone. On desktop it goes beside the panel.
- **How:** reuse ImageryCredit's mechanics. They already keep the credit above the sheet, and the camera already reserves the pill's height, so the route is never framed under it.
- **On Satellite:** prepend the OSM part to the existing Sentinel or PNOA pill, which has room on its second line. It stays one credit block, not two.
- **The "i":** keeps Terrain Tiles and the Credits link. Data policy should confirm the DEM credit may stay behind the tap.

Why not the 5-second version: opened, it is a 3-line box over the foot of the map exactly where routes end (c-attrib-open). It would come back on every language rebuild. Its motion at load competes with the route drawing in. A quiet static line is calmer, matches what Satellite already does, and costs one line.

## What works, don't break it
- The route stack per theme, especially the satellite white band plus dark rim and the light navy edge plus white rim. Both are tested for colour blindness and on every surface.
- The stepped-back overlay: the route is the only full-strength colour. Keep the satellite fade-out at z13.5 to z14 until ROADMAP 21 lands.
- Labels above the route and overlay. Stop labels win collisions. Village density at z12 is sparse and right (d-zoom-8: Laspuña, Lafortunada, Cotiella).
- Badges: a dark disc with a rating-coloured halo, readable at every zoom, with the same colour as the summary chips.
- No hillshade over the photo, and the photo left unmodified (its licence requires it).
- The light hillshade values pinned by the test (theme.ts:235-238); a stronger shadow muddies the deep ramp.
- The style picker thumbnails and the GENTLE to EPIC legend pill.
