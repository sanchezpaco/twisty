# Cartography review of Batch D slices 3–4 (batch-d3 6b59cb6) — 2026-10-13

Cartography review of Batch D slices 3–4: branch `batch-d3` at 6b59cb6, compared against its base 5af3876.

**Verdict: do not land yet.** There is one blocker. On short trips the map never zooms to the ride. The colours, casing and badges are a clear step up on main.

**How I checked.** I copied `app/src` from the worktree into my scratchpad, checked it matched 6b59cb6 file for file after the worktree was re-created, and added one line that exposes `window.__map`. I built that copy and the base 5af3876 the same way and served them on ports 4321 and 4322. Both previews are now stopped, and no repository files were touched.

Shots and scripts are in `<scratchpad>/carto/` (shots in `shots/`, below `S/` means that folder). The phone shots were taken at 360×780 ×3 and 412×915 ×2.6, the desktop at 1440×900 ×2. The rides were:
- València → Los Santos de Maimona
- San Sebastián de los Reyes → Santiago de Compostela (Galicia)
- Oviedo → Potes (Asturias)
- Jaca → Benasque with tracks, and in 3D

## 1. Scores

- **Route as hero: 6.** Once framed, the route wins at zooms 7–13 and in 3D, even over the dense Asturias and Galicia overlay (`S/shots/asturias-1440x900-es-z9.png`, `long-360x780-es-z8.png`, `pyrenees-412x915-es-3d.png`). But short trips stay at the Spain-wide view, where the route is a speck (`trk-framed-max.png`, zoom 4.14). Without that bug I would give it 8.
- **Curve colours: 7.** The ramp is ordered, and the closest pair still differs by 38 colour-distance units (CIE ΔE; higher means easier to tell apart).
  - Colour-blind safety: for red-green colour blindness (deuteranopia) the weakest pair is Revirada yellow vs Muy revirada orange, ΔE 15. Lightness still separates them (86 vs 69).
  - Contrast against the land colour: Suave blue #3d7be0 is 4.7:1, Épica #ff2e6e 5.4:1, against 11.7:1 for the white non-twisty part of the route.
  - The dimmed overlay sits at 1.2–1.6:1 against the land, and the route stands 3.8–8.4:1 above the same colour dimmed. The overlay does not drown the route.
- **Base map: 7.** Labels and their density are fine at each zoom, but the route is drawn over town names. Examples: "Monforte de Lemos" reads "nforte de Lemos" in `long-360x780-es-z8.png`, and "Vilariño …onso" in `long-360x780-es-z10.png`.
- **Relief: 8.** Hillshade stays quiet under the yellow route at zoom 12, and 3D on the Jaca pass is clean (`pyrenees-412x915-es-z12.png`, `-3d.png`).
- **Consistency: 9.** One `RATING_COLORS` list now drives the overlay, the route, the badge rings, the list rings and the slider bars. The badge ring matches its list row (1440 shots). Tracks share a warm hue with Revirada and differ by ΔE 27 (13 for blue-yellow colour blindness), but the dashes carry them (`trk-z13.png`).

## 2. Findings, most severe first

1. **Blocker – a new trip is never framed when it is short (regression from bc08fea).**
   - Evidence: Jaca → Benasque at 412 px stays at zoom 4.14 for 16 s on 6b59cb6, but goes to 7.84 on 5af3876 (`S/frame.mjs` timeline). Shots: `S/shots/trk-framed-fastest.png`, `trk-framed-max.png`, `asturias-1440x900-es-framed.png`.
   - Cause (`MapView.svelte:157–168` with `whenSheetSettles`): the fastest ride queues `fit(line)`. When the full results arrive before the sheet settles, the effect runs again with `newTrip === false` and replaces the queued move with `fitIfHidden`. A short route is already "visible" at the Spain view, so nothing moves.
   - Your 32 shots missed it because both test trips cross Spain, so the Spain view already looks framed.
   - Fix: decide at settle time, for example `untrack(() => whenSheetSettles(() => { if (trip !== framedTrip) { framedTrip = trip; fit(line) } else fitIfHidden(line) }))`, and remove the `framedTrip = trip` assignment from the effect body.
   - Add a short trip (Jaca → Benasque) to the shot set. Owner: frontend.
2. **Minor – the twisty glow has spiky edges.** MapLibre's blur (`line-blur 12` on an 18 px line) leaves star-like spikes at the bends, at zooms 7–12 on the hero line.
   - Evidence: `S/shots/crop-spikes.png`; `glow-z10-compare.png` stacks current / width 16 + blur 6 / width 14, no blur, opacity 0.22.
   - Fix in `layers.ts` `route-twisty-glow`: drop the blur. Use one line of width 14, opacity 0.22, no blur, plus an outer band of width 20 at opacity 0.10 for the soft falloff. Keep the 9 px casing and 6 px line exactly as they are. Owner: frontend.
3. **Minor – fewer badges than necessary make it through.**
   - `route-endpoints` sets `icon-size` to `ENDPOINT_RESERVED_PX / (2*BADGE_RADIUS_PX)`, but the image is `2*(radius+margin)` = 30 px wide. So the space kept free around each pin is about 54 px, not the intended 40.
   - Fix: divide by `2*(BADGE_RADIUS_PX+BADGE_MARGIN_PX)`.
   - Separately, the image already includes the 4 px SDF margin, so `icon-padding: 4` on top leaves about 11 px between rings. Use `BADGE_PADDING_PX = 1`.
   - At 1440 the Galicia ride shows only 1, 4, 6 and 8 of 9 at the framed zoom (`d3-long-1440x900-es-max.png`); at 360 it shows 1 of 9. Owner: frontend.
4. **Minor – the legend words are too faint for a phone in sunlight.** `.legend` uses `--text-faint` #5c657a on the glass, which is about 3.3:1 at 10.5 px.
   - Fix: use `--text-muted` #8f98ab, about 6.5:1, the same as the 3D label.
   - Placement at 360 in ES is fine: no overlap, 8 px gap (`long-360x780-es-z8.png`).
   - The spec says the pill hides in the editor and at full, but the code has no condition. The sheet's z-index covers it at full; please confirm the editor case. Owner: frontend.
5. **Minor – the route covers place labels (this predates the branch; the 9 px casing makes it slightly worse).** Evidence in Base map above.
   - Fix: add the overlay and route line layers with `beforeId: 'peaks'`, so the haloed labels sit on top. Keep `route-badges` and `route-endpoints` on top of everything. Owner: frontend.
6. **Minor – Suave blue is the dimmest part of the route.** On a ride that is mostly Suave (the 121 km of N-322 in the València ride), the white non-twisty part (11.7:1) out-shines the twisty part (4.7:1) in sunlight.
   - Fix: lighten `RATING_COLORS[0]` to about #5b95f2 (aim for at least 6:1). Overlay, bars and route change together, so consistency holds.
   - Optionally lower `route-transit` opacity to 0.75. Owner: frontend.
7. **Minor – yellow on dimmed orange in dense areas.** In Galicia and Asturias the Revirada route sits on a same-hue web. It still reads first, thanks to width, casing and glow (`long-360x780-es-z8.png`), but with less margin than main's pink.
   - I confirm 0.2 / 0.05. If you want more margin, recolour the overlay to a neutral #8a93a6 at 0.2 while a ride is shown, so the route is the only colour. That is optional; I would not hold the branch for it.
8. **Out of scope, for pipeline or routing – a straight road counted as a twisty.** Twisty 1 on València is "N-322, 121 km, Suave", and it runs dead straight through Albacete and the La Mancha plain (`valencia-360x780-es-z9-n322.png`). The longest "twisty" of the ride is a plain national road, and it takes the top badge.

## 3. Builder's questions

**(a) Badge numbers skipping (1, 2, 5): keep stable numbers, do not renumber.**
- Each number identifies a row in the list, the order in the slider bar and the order of the Google Maps waypoints. If the visible badges were renumbered, "2" would mean a different road at each zoom and the link to the list would break.
- Skipping already happens when badge 1 gives way to the A pin (Asturias at zoom 9 shows 2, 3, 4).
- Two mitigations:
  - Fix finding 3 so fewer badges hide.
  - Have a list-row focus show its badge: for example, give the focused twisty the lowest sort key until the next ride.

**(b) Side panel height following the list while sliding: a mild problem, mostly because of the button.**
- The panel's bottom edge now jumps: 909 → 965 → 1072 px over the first steps (Oviedo → Potes, 884×1104).
- The "Abrir en Google Maps" button already jumped on main as well, by 40–170 px per step on both commits. It only pins once the list overflows.
- Fix: while a ride is shown, give the panel a fixed height (`bottom: 16px`, as before for the ride state) and push the button bar to the bottom with `margin-top: auto`. Keep the content-height panel for the intro, planning and editor states. Owner: frontend.

## 4. What works – don't break it

- The 6 px rating-colour line over a 9 px #07090d casing. The casing makes the route stand out even from an overlay line of the same colour (`pyrenees-412x915-es-z12.png`, `long-…-z10.png`).
- Overlay dimmed to 0.2 / 0.05: context stays readable and never competes with the route's width.
- One `RATING_COLORS` list for overlay, route, badge rings, list rings and bars; tracks still dashed in earth colour with their casing.
- Badges in one symbol layer with no overlap and with space kept free under the pins. Main stacked badges 2/3 and 5/6 (`d1-final/d1-long-1440x900-es-max.png`); now none overlap.
- Legend pill at the top right, no pointer events, fits at 360 in ES, same glass as the 3D toggle.
- 3D on a pass, and attribution: the "i" button stays visible bottom-right in every shot (no blocker there).
