**Twisty release UX review: main 5b9590d, shot set data/review-2026-10-19/**

I found no UX blocker. I would put this on the Play Store after the majors below. The only item that could become a blocker is M1, and it needs a check on the phone. I also took 5 extra states myself: `app/dist` (served by `vite preview` on port 4319, server stopped since), headless at 360×780, no address searches. They are in <scratchpad>/shots/ (`small-*.png`).

## Scores
- **Hierarchy: 8.** The ride sheet leads with the time ("2 h 30"), then the trade chip, the bar slider and the gradient "Open in…". The route's twisties glow with numbered badges, and the overlay dims to 0.2 behind a ride (`app/src/lib/map/theme.ts:208`). Evidence: 05-ride-A-default-huawei-en.png, 06-ride-A-max-curves-huawei-en.png.
- **Transitions: 7, provisional (stills only).** The overlay fades over 600 ms (`app/src/lib/map/overlay.ts:61`), badges fade, and the folded sheet keeps the summary and the button (scratchpad `d-collapsed.png`). I could not judge jank. See M1 for the camera.
- **Touch: 8.** 25 px to look at, 44 px to hit (`app/src/app.css:24`, `app/src/components/Panel.svelte:1118-1124`). The main button sits low on the left, under the thumb.
- **Clutter: 7.** The legend, 3D, layers and "i" are on the map at all times. The summary ends in two grey paragraphs (08-summary-scrolled-huawei-en.png). Open in… has three text blocks before the first choice (09-open-in-huawei-en.png). Badges 2 and 3 collide (05-ride-A-default-huawei-en.png).
- **Mobile sheet: 8.** Full-screen search, a summary card, a folded state that keeps time and button, recent trips for a returning rider (scratchpad `e-returning-start.png`). Spanish copy fits everywhere I checked.
- **Fold-open / desktop panel: 7.** The floating panel with the brand looks designed, and the route is framed in the free map to its right (17-ride-C-fold-open-en.png). Two layering slips: M2 and m4.
- **Fold cover: 7.** It is the phone layout, roomier. The edge cuts are the issues already filed.

## Findings

### Major

**M1. Camera stays on the Spain view after a plan in headless, unverified on a phone.**
- Shots: `scripts/shots.mjs:14` ("about half the plans"); my own run, scratchpad `c-planned.png`. In my run, 8 s after the plan there was still no route, no labels and the overlay was not dimmed, so the map looks half-loaded.
- What is wrong: probably a swiftshader artefact. But if it ever happens on a phone, the rider gets a summary with no route, which would be a blocker.
- Fix: before release, plan 10 trips in a row on the Huawei and check that the camera flies to the route every time.
- Owner: app (director runs the check on the phone).

**M2. Fold-open search list is narrower than the panel and the intro text shows through on its right.**
- Shots: 03-town-search-fold-open-en.png, 03-town-search-fold-open-es.png.
- What is wrong: fragments of the intro ("the", "ickly,", "ends.", "redits") show at the list's edge, and the "Search streets…" row is pushed out of view. This is the first thing a Fold-open user touches.
- Fix: make the list as wide as the panel on an opaque surface, or hide the intro while it is open, as the phone does.
- Owner: app.

**M3 (your item d, confirmed). The A/B pins cover the label of the town they mark.**
- Shots: 16-, 17-, 18-, 19-*-huawei-en.png and the fold variants ("Va A cia").
- What is wrong: it happens on almost every town-to-town ride, because a town pick lands on the label's own spot. It will also show in the store screenshots.
- Fix: draw A/B as a symbol layer that takes part in label placement (`icon-allow-overlap: true`, `icon-ignore-placement: false`), so the base map drops that town label instead of splitting it.
- Owner: app.

### Minor

**m1 (your item c, confirmed). The share toast covers the Google Maps note and leaves fragments of it.**
- Shots: 10-share-huawei-en.png, 10-share-fold-open-es.png ("Each … Maps").
- Fix: give the toast the full row width on an opaque surface, or fade the note while the toast is up.
- Owner: app.

**m2. The trade chip uses the error red family.**
- Shots: 05-ride-A-default-huawei-en.png (chip) next to 19-leg-error-huawei-en.png (error).
- What is wrong: the trade ("+39 min / +31 km of curves") is the good news, but it reads like a warning.
- Fix: use the orange accent or a neutral border for the chip and keep red for errors only.
- Owner: app.

**m3. Numbered badges collide at the default slider stop.**
- Shots: 05-ride-A-default-huawei-en.png, 05-ride-A-default-fold-cover-en.png (2 on 3; 4 and 5 crowd B).
- Fix: in `badgePlacement.ts`, slide a badge along its twisty when it would overlap another badge or a pin.
- Owner: app.

**m4. Secondary sheets show cut-off content of the sheet behind them.**
- Shots: 09-open-in-huawei-en.png and 11-save-sheet-huawei-en.png (top halves of "2 h 57" between the two sheets); 09-open-in-fold-open-en.png (bars stick out above the sheet inside the panel, and the panel has no dimming).
- Fix: dim the panel content behind the sheet in the side layout too, and start the phone sheet at the trip card's edge.
- Owner: app.

**m5. A via stop is not named on the phone ride card.**
- Shot: 17-ride-C-huawei-en.png ("València ●→ Segorbe").
- What is wrong: the rider cannot see that Teruel is included without opening the editor.
- Fix: show "via Teruel" under the arrow, or "+N stops" when there are several.
- Owner: app.

**m6. No brand on the phone's first launch.**
- Shots: 01-first-launch-huawei-en.png has no logo or name; 01-first-launch-fold-open-en.png has both.
- Fix: put the logo and wordmark next to "Where are we riding?" while there is no history.
- Owner: app.

**m7 (your item f, confirmed but dismissed as a cut).**
- Shots: 17-ride-C-huawei-en.png, 18-ride-D-loop-huawei-en.png.
- Every map cuts labels at the screen edge, so the cut itself is fine. The real issue is the doubled three-line "Castelló de la Plana / Castelló de la Plana" label.
- Fix: show one name for settlements.
- Owner: app, cartographer's call.

### Dismissed
- **e:** the dot is inside the frame. The "Pal…" cut is the filed via-points label item plus ROADMAP 29 (Fold cover edges). On fold-open, Palma is fully framed (19-leg-error-fold-open-es.png).
- **g:** by design. The strip stays open while styles are tried and closes on any touch or Back (`app/src/components/MapStylePicker.svelte:31`).

## Where the new items fit

**OSM attribution**
- Put a permanent short "© OpenStreetMap" text line next to the "i" button in the map's bottom-right corner, at 11 px in the faint text colour, in every style and layout. The full text stays behind "i".
- In Satellite, add it to the start of the imagery credit strip, so there is one credit line and not two (15-satellite-huawei-en.png).
- Don't put it in the intro copy: the map shows OSM data in every state. The fold at load stays as it is, since `MapView.svelte:333` folds it so the open credit does not cover the route's end corner.

**Privacy**
- Put it in the intro foot as a second text link next to Credits: "Credits · Privacy" / "Créditos · Privacidad".
- It fits at 360 px: about 165 dp is free to the right of the language pills, and the Spanish version needs about 125 dp. Use the same `::before` hit area as Credits.
- Also add it as the last section of the Credits sheet.

**Safety notice: three placement problems in the plan**
1. **Ride summary footer.** The summary already ends with "On mountain roads… Ride to the signs.", followed by the Google Maps note. A third grey line makes a wall of text. Merge the general sentence into that paragraph, and show it even when a ride has no road warnings. Never put it in the band above the button: that band stays one line, the Google Maps note.
2. **Open in….** The sheet already has a title, a subtitle and the GPX advice before the choices, and on the Huawei "Other app (GPX)" already sits at the bottom edge. Drop the subtitle "Pick the app to ride it with" (it repeats the title) to make room for the one-way line.
3. **First launch.** Use the faint `.tip` style inside the `history.length === 0` block. It costs one line, and on the Huawei the sheet already starts at 56% of the height.

The "Use at your own risk" section belongs at the end of Credits, next to Privacy.

## What works, don't break it
- The dark map with a dimmed overlay, the route's twisties glowing in their rating colour with badges, and a route that stays readable in Light and Satellite.
- The large time headline, the trade chip, and bars that line up with the slider stops.
- The search: full screen on the phone, offline towns with "Village near X", and an explicit street-search row.
- The folded sheet that keeps time and the button, and the 44 px hit areas behind small visuals.
- The fold-open panel with the brand, and the route framed in the free map.
- The in-place leg error with a single "Change this stop" action.
- Saved-ride thumbnails showing the twisties in colour, and recent trips replacing the intro for a returning rider.

