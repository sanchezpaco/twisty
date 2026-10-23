# Batch D design spec: phone sheet, trip editor, side panel, route colours

Looked at `main` 95c5bb3. The app ran in headless Chrome at 360×780 (ES) and 884×1104 (EN), trip València → Los Santos. Screenshots are in `<scratchpad>/shots/`. Batch A is in progress on `batch-a`, and this spec assumes it has landed.

## 0. What I measured

| Fact | Evidence |
| --- | --- |
| The folded ride sheet is 406 px tall at 360×780 (52 % of the screen). | `360x780-es-ES-04-ride-folded.png` |
| When expanded, the main button scrolls off-screen: it sits at y=1025 at 360×780 and y=1151 at 884×1104. | `05-ride-expanded.png` (both sizes) |
| The headline breaks onto two rows at 360: the time on one, the chip ("+38 min · +74 km de curvas", 205 px) on the next. Total height is 78 px. | `04-ride-folded.png` |
| On the max-curves option the route glows pink/amber everywhere, but the bars show the twisties are mostly Flowing (cyan) and Twisty (yellow). | `06-ride-max.png`, `layers.ts` (`route-twisty` line-gradient) |
| Badge 3 sits under the B marker, and badge 2 is cut by the sheet edge. | `04-ride-folded.png`, `06-ride-max.png` |
| The handle shrinks to 9–13 px when expanded, because it is not in the `flex: none` list. | measured rects |
| The breakpoint is written in two places: `Panel.svelte:16` (`max-width: 899px`) and `MapView.svelte:162` (`min-width: 900px`). | |
| The sheet animates `max-height`, which forces a layout on every frame. | `Panel.svelte:605` |

## 1. Shared rules (apply to every item)

- **Breakpoint.**
  - Add one constant, `SIDE_PANEL_QUERY = '(min-width: 700px)'`, in a new `app/src/lib/layout.ts`.
  - `Panel` and `MapView` both use it. Below 700 px you get the phone sheet; from 700 px the floating side panel.
- **Motion.**
  - Animate only `transform` and `opacity`, using the existing `--ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`).
  - Never animate `height` or `max-height`, and never read layout during a drag.
  - With `prefers-reduced-motion`, JavaScript animations (route draw, map easing) jump straight to their end state.
- **Glass.**
  - Keep the blur on the sheet and panel (measured at about 6 ms RenderThread, no fps change), with the Batch A surface opacity of 0.94.
  - If a drag on the Huawei shows dropped frames that trace back to the blur, drop the blur below 700 px only, and set the opacity to 0.96.
- **Touch.** Every control is at least 44×44 px. A visual element may be smaller if a pseudo-element extends its hit area.

## 2. Item 1: draggable bottom sheet with snap heights (phones, < 700 px)

### Structure

- The sheet is one element:
  - `position: fixed; left: 0; right: 0; top: 0`
  - `height: 100dvh`
  - moved only by `transform: translate3d(0, Y, 0)`, where Y = viewport height − visible height
  - `will-change: transform` set permanently.
- The sheet's content is a stack of three blocks, in this order:
  - **Block 1:** grabber, trip row, headline.
  - **Block 2:** slider.
  - **Block 3:** details.
- New order: the headline now sits **above** the slider. This way the thumb dragging the slider no longer covers the time it is changing. Use the same order on desktop.
- **Pinned footer.**
  - The main button is not inside the moving sheet. It is a separate `position: fixed; bottom: 0` footer with the same surface colour, stacked above the sheet.
  - Size: 10 px top padding, 54 px button, 12 px + `env(safe-area-inset-bottom)` bottom padding, so 76 px + safe area.
  - It stays still during drags, so the main button is visible at every snap.
  - The sheet content gets `padding-bottom` equal to the footer height.

### Heights at 360×780 and 412×915

Measured from content with a ResizeObserver on the blocks. It fires on content changes only, not on transforms.

| Snap | What is visible | Height |
| --- | --- | --- |
| peek | grabber (32) + trip row (44) + gap 8 + headline (60) + gap 12 + footer (76) | **≈ 232 px** + safe area |
| half | peek + slider block (≈ 124, fixed height from Batch A item 10) | **≈ 356 px** (46 % at 780, 39 % at 915) |
| full | everything; the body scrolls | `min(content, 100dvh − safe-top − 48 px)` |

Content shorter than a snap removes that snap. The sheet never shows empty space under its content.

### Snaps per state

| State | Snaps available | Default snap |
| --- | --- | --- |
| Start (fields, options chip, intro) | peek = fields + chip (≈ 204); half = + intro, capped at 60 % | half |
| Planning (first plan of a trip) | one snap: trip row + planning animation | that snap |
| Error / no route | one snap: trip row + error card | that snap |
| Ride (new trip) | peek, half, full | **half**, which keeps the content riders praised |
| Ride with tracks | footer grows by one line (≈ +28), see item 6 | half |
| Trip editor | full-screen mode, see item 3 | n/a |

**Choreography from planning to ride:**

- The editor closes into the planning snap, so the map has room while the route is computed.
- When the ride arrives, the sheet rises to half while the route draws itself in.
- The camera fits the route straight away with the **target** snap's padding, not the current one.

### Gestures

- **Where a drag can start:**
  - the grabber;
  - the trip row (after slop; this cancels its click);
  - the headline;
  - any non-interactive sheet surface.
- The slider block (bars and range input) is excluded with `data-no-drag`.
- **Slop:** 6 px, and the vertical movement must be larger than the horizontal one.
- **Following the finger:**
  - The sheet follows the finger 1:1 between peek and full.
  - Past either end it rubber-bands at 0.35× the finger movement, up to 48 px.
  - Writes happen in requestAnimationFrame (rAF), with no layout reads.
- **On release:**
  - Velocity is measured over the last 100 ms of samples.
  - If |v| ≥ 0.4 px/ms, the sheet goes to the next snap in that direction.
  - Otherwise it goes to the nearest snap.
  - The settle animation is 300 ms `--ease-out`.
- **Full snap, body scrolled to the top:**
  - A downward drag hands over to the sheet.
  - Use `touchmove` listeners with `{ passive: false }` on the body.
  - Pointer events with `touch-action: pan-y` cannot take the gesture back once the browser has started scrolling.
- **The body only scrolls at full.** At peek and half it is `overflow: hidden`, so a vertical drag anywhere moves the sheet.
- **Grabber:**
  - It is a `<button>`: 32 px tall inside the sheet, plus a `::before` that extends 12 px above the sheet edge, so 44 px in total.
  - Visible pill: 36×4 px.
  - A tap goes peek→half, half→full, full→half.
  - `aria-expanded` is set to true at full.
- **Android back** at full goes to half.
- **Tapping a twisty in the list** at full snaps the sheet to half, then flies to the twisty with the half padding.

### Map padding follows the sheet

- When a settle starts, set the target snap's visible height as the bottom padding: `map.easeTo({ padding: { bottom: visible + 16, … }, duration: 300 })`, with the same easing.
  - The map then glides with the sheet instead of jumping. A bare `setPadding` shifts the centre instantly.
- Padding never changes during a drag (frame by frame).
- At full, keep the previous padding, so going back to half does not move the camera.
- After the settle at peek or half, if the route is not inside the padded rectangle, fit it (600 ms).
- The attribution sits above the visible sheet through a CSS variable, `--sheet-visible`, which is updated together with the padding.
- This replaces `bind:clientHeight` (`Panel.svelte:62`). The snap's visible height becomes the `sheetHeight` that MapView reads.

### i18n

| Key | EN | ES |
| --- | --- | --- |
| `panel.expand` | "Show more" | "Mostrar más" |
| `panel.collapse` | "Show less" | "Mostrar menos" |

### Acceptance

- **Default snap.** At 360×780, València → Los Santos at the default stop:
  - the sheet is at half and 356 ± 8 px visible;
  - the whole route, A and B, sits above the sheet;
  - the main button's bottom edge is at 780 − 12 − safe area.
- **Snapping.**
  - A flick ≥ 0.4 px/ms from half lands on peek (downward) or full (upward).
  - A slow drag released past the midpoint lands on the nearest snap.
  - Never between snaps.
- **Main button.** Visible and tappable at peek, half and full, in EN and ES.
- **Performance.** A Huawei trace of a drag shows no `Layout` events and no frame over 33 ms caused by the sheet.
- **Map.** The map moves only at settle, in 300 ms, in sync with the sheet.
- **Touch.** Grabber hit box ≥ 44 px; a tap cycles the snaps.

## 3. Item 2: full-height trip editor (phones)

### Opens

- On focus of a place field.
- From a tap on the trip row. The row is split into two buttons, A-name and B-name, each 44 px tall, and each focuses its own field.
- Drop the "Edit"/"Cambiar" word. The row already looks like a field.

### Layout

- The sheet goes to `translateY(0)` with `padding-top: calc(env(safe-area-inset-top) + 8px)`, so the status-bar band shows the sheet surface.
- Content, top to bottom:
  1. A 44 px row with a back button (44×44, left arrow).
  2. The existing fields block (2 × 48 px, plus locate and swap at 44 px).
  3. The options chip row (item 7), shown only while no suggestion list is open.
  4. The suggestion list, inline (not an absolute dropdown).
- The list takes the remaining height.
- The editor's `padding-bottom` is `var(--keyboard-inset)` from Batch A item 7. It is set once per keyboard show, with no transition. This keeps the last row above the keyboard.
- Rows are at least 52 px tall (label 15/500, detail 12.5 muted).
- The first row is highlighted, so Enter picks it.
- The list uses `overscroll-behavior: contain`.

### Flow

- When a place is chosen and the other field is empty, focus moves to the other field. The keyboard stays up.
- When the choice completes the trip, the editor closes:
  - blur, keyboard down;
  - the sheet goes to the planning snap.
- The tracks toggle (in the chip) blurs the field but keeps the editor open. If A and B are set, re-planning starts.

### Closes

- Back button, Android back, Escape (restores the committed value, as in Batch A), or a downward drag on the grabber.
- After closing, the sheet goes back to the previous snap.

### Motion

- Ride content fades out in 120 ms.
- The sheet moves to the top in 280 ms `--ease-out`.
- Editor content fades in over 160 ms, after a 60 ms delay.
- `focus()` runs inside the tap handler, after `await tick()`, so Android opens the keyboard. Check this on the Huawei.
- The fields must stay in the DOM at all times: hide them with `visibility`/`opacity`, not `display: none`.

### States to cover

- Empty query (no list).
- Town results.
- No towns plus "Search streets…".
- Address search spinner.
- "No addresses found".
- Offline: "Address search is unavailable right now".

### i18n

| Key | EN | ES |
| --- | --- | --- |
| `panel.closeSearch` | "Close search" | "Cerrar búsqueda" |
| `panel.changeStart(label)` | "Change start: {label}" | "Cambiar salida: {label}" |
| `panel.changeFinish(label)` | "Change finish: {label}" | "Cambiar llegada: {label}" |

Remove `panel.edit` and `panel.editTrip`.

### Acceptance

- At 360×780 with the keyboard up, typing "Guadal" shows at least 4 full rows above the keyboard, and the last result can be scrolled into view.
- Choosing A moves focus to B with no keyboard flicker.
- Choosing B closes the editor and planning starts.
- Back without changes returns to the previous snap with the same ride and camera.
- Nothing in the editor sits under the status bar.

## 4. Item 3: floating side panel from 700 px (unfolded Fold, tablets, desktop)

| Width | Panel width | Map padding |
| --- | --- | --- |
| 700–1023 px | 360 px | left 416, top 60 + safe-top, right 60, bottom 60 |
| ≥ 1024 px | 400 px (as today) | left 456, top 60, right 80, bottom 60 |

- The panel sits at `top: calc(16px + env(safe-area-inset-top))`, `left: 16px`, `bottom: 16px`. When the content is short, the bottom is `auto` (as today).
- On the 884 px Fold the panel runs from x 16 to 376. That stays clear of the hinge at x ≈ 442, and leaves a map 408 px wide.
- **Same as desktop today:**
  - logo header;
  - fields always visible, with no trip row and no editor;
  - suggestions as a dropdown;
  - no grabber, no snaps.
- **New in the panel:**
  - the options chip under the fields;
  - headline above the slider;
  - the main button **sticky at the panel's bottom** (`position: sticky; bottom: 0` inside the scrolling body), so it never scrolls away.
- **Posture change (fold or unfold while the app is open):**
  - the layout swaps through the `matchMedia` listener;
  - padding is re-applied and the route refitted (400 ms);
  - an open editor becomes a focused field with a dropdown.

### Acceptance

- At 884×1104 the ride shows a 360 px panel and the whole route in the remaining map.
- No phone sheet or grabber appears at 700, 768, 884 or 1440 px.
- The phone layout appears at 699 px.
- The main button is visible without scrolling at 884×1104 and 1440×900, on max curves.

## 5. Item 4: legend and route coloured by rating

**Decision: colour each twisty stretch of the route by its own rating.** Use `RATING_COLORS[rating-1]`, the same ramp as the overlay, the bars, the mix bar and the list words. A "Fluida" stretch then reads cyan everywhere.

The route stays the hero through weight and contrast:

- **Twisty line:** 6 px, solid rating colour, opacity 1.
- **Casing under it:** 9 px `#07090d` at 0.8 opacity, as transit already has.
- **Glow:** rating colour, width 18, blur 12, opacity 0.45.
- **Overlay while a ride is shown:** line opacity goes from 0.3 to **0.2**, glow from 0.08 to 0.05. The route is then the only full-strength colour on the map. Cartographer to confirm, and check Gentle `#3d7be0` on the hillshade.
- **Transit** stays white. **Tracks** stay dashed in earth colour.
- **Badges:** the ring takes the twisty's rating colour.
- **List:** the `.number` ring in the twisty list takes the same colour.
- **Data:** add `rating` to twisty `RouteSegment`s in `lib/routing/ride.ts`. This is a one-field change; coordinate with the routing session. Do not zip segments by order in the renderer.

**Legend:**

- A pill on the map, not inside the sheet, so it is visible at every snap and from the start screen onwards.
- Position: top-right, to the left of the 3D toggle with an 8 px gap. Both use `top: calc(env(safe-area-inset-top) + 12px)`.
- Height 36 px. Content: "SUAVE" [5 swatches of 10×6 px, 2 px gap] "ÉPICA", 10.5 px, weight 600, uppercase, letter spacing .08em, colour `--text-faint`. Same glass surface as the 3D toggle.
- `pointer-events: none`.
- Hidden in the editor and at full.
- Remove the duplicate legend from the intro.

**i18n:**

| Key | EN | ES |
| --- | --- | --- |
| `map.legend` (aria-label) | "Curve character" | "Carácter de las curvas" |

The end labels reuse `ride.ratingWords[0]` and `[4]`.

**Acceptance:**

- On València → Los Santos max curves, every twisty stretch on the map matches the colour of its list row and of the bar stack.
- The legend pill does not overlap the 3D toggle at 360 px in ES.
- Cartographer: the route is still the first thing the eye finds at zooms 7 to 12.

## 6. Item 5: slider transitions

- **First draw (draw-on) runs once per plan result:**
  - a new `options` array (new trip, tracks toggled, restore after an Android kill);
  - draws from A to B in 1100 ms, `easeOutCubic` (unchanged).
- **On a stop change within the same result:**
  1. Compute the shared prefix and suffix of the old and new coordinate lists. Exact equality works because both come from the same graph. Use a pure, tested function: `routeDiff(oldLine, newLine) → { prefixEnd, oldSuffixStart, newSuffixStart }` (the shared suffix starts at a different index in each line, and the ghost needs the old line's).
  2. The shared parts stay drawn and untouched.
  3. The old route's changed stretch moves instantly to a `route-ghost` source with one layer: 4 px, `#e6ebf5`, opacity 0.35.
  4. The new route's changed stretch draws on from the point where the routes split to the point where they meet again, in **250 ms `easeOutCubic`**.
  5. At the end, the ghost is cleared and the new badges fade in over 150 ms. Renumbering is instant.
- **Rapid steps:** a new step completes the running transition instantly, then starts its own.
- **Uploads:** each animation frame uploads only the changing stretch. The stable route is uploaded once per step (this matches Batch C item 4).
- **Camera:** no camera move on a step, unless the new route leaves the padded view (Batch A `fitIfHidden`).

**Acceptance:**

- From the default stop to the next one on València → Los Santos, the A-side motorway never disappears. Only the changed stretch animates, for about 250 ms.
- Scrubbing from end to end never shows an empty map.
- Huawei: a slider step stays under 2 frames of main-thread work outside the 250 ms animation.

## 7. Item 6: ride with tracks

- **The main button is always in the pinned footer** (item 1), so the folded state can no longer hide it.
- **Threshold:** `GPX_PRIMARY_MIN_TRACK_M = 2000`, a named constant in `RideSummary`. Rider-safety must confirm it.
- **Rides with ≥ 2 km of track:**
  - GPX is the main button;
  - "Google Maps (may skip the tracks)" is the secondary button, in the details.
- **Rides below 2 km of track (but more than 0):**
  - Google Maps is the main button;
  - GPX is the secondary button, in the details.
- **Track line in the footer (any track km above 0):**
  - one line in earth colour above the main button, 12.5 px, wrapping to at most 2 lines, never truncated;
  - a tap snaps the sheet to full;
  - the full warning stays in the details, unchanged.
- **i18n:**

  | Key | EN | ES |
  | --- | --- | --- |
  | `ride.tracksLine(km)` | "{km} km of tracks, may be closed or rough" | "{km} km de pistas, quizá cerradas o en mal estado" |

- **Acceptance:**
  - 0.2 km of track: Google Maps is the main button and the track line is visible at peek.
  - 3 km of track: GPX is the main button.
  - In both cases the main button and the track line are visible at peek, half and full, at 360×780 in ES.

## 8. Item 7: options chip

- **Where:**
  - phones: under the fields, left-aligned, in the start sheet and in the editor;
  - side panel: under the fields.
- **Not in the ride view.** Riders reach it through the trip row, then the editor.
- **Chip:**
  - 32 px visible, 44 px hit area, fully rounded (`radius: 999px`);
  - `--surface-raised` with a 1 px inset `--border`;
  - text 13/500 `--text-muted`;
  - 14 px sliders icon in front, chevron after it that rotates 180° when open (`transform`, 200 ms).
- **Tap:** an inline disclosure under the chip shows today's "Incluir pistas" switch row, with its label and description, unchanged.
  - Default closed; closes when the editor closes.
  - `aria-expanded` on the chip.
- **Tracks on:**
  - chip text becomes "Opciones · Pistas" in `--earth`;
  - background `rgba(210,168,110,.12)`;
  - inset border `rgba(210,168,110,.5)`.
  - The state is visible without opening the chip.
- **i18n:**

  | Key | EN | ES |
  | --- | --- | --- |
  | `options.label` | "Options" | "Opciones" |
  | `options.withTracks` | "Options · Tracks" | "Opciones · Pistas" |

- **If Batch A already ships a chip,** this item is a restyle only.
- **Acceptance:**
  - The start sheet shows no switch until the chip is tapped.
  - With tracks on, the chip says so while closed.
  - The chip's hit box is ≥ 44 px.

## 9. Item 8: small fixes

### Headline (the summary chip truncation)

- Grid with two columns:
  - **Left:** time at 40/1, with the km under it (13 px, muted).
  - **Right:** a two-line badge with the extra time (15/600 pink) over "+{km} km of curves" (12.5/500).
- 60 px tall.
- The fastest option shows a one-line cyan badge.
- **Acceptance:** at 360 px in ES, with "+2 h 59 · +999 km de curvas", there is no wrap and no ellipsis.

### Trip row

- Each name shrinks with an end ellipsis (`min-width: 0`).
- Removing "Cambiar" frees about 76 px.
- **Acceptance:** "San Sebastián de los Reyes → Santiago de Compostela" at 360 px shows at least 8 characters of each name.

### Labels and wording

| Key | EN | ES |
| --- | --- | --- |
| `ride.other` | "Other" | "Resto" |
| `ride.twisties` | "Curves" | stays "Curvas" |
| `ride.twistiesHeading` | "Curvy roads on this ride" | stays |
| `slider.option` | "{extra} · {km} km of curves" | stays |

- Replace `ride.gain` with `ride.curvesGained(km)`: EN "+{km} km of curves", ES "+{km} km de curvas".
- **Acceptance:** no stat label ellipsis at 360 px with 3 or 4 cards (the 4-card layout depends on Batch A's overflow fix).

### Badge and marker collisions (cartographer + frontend)

- Turn `route-badges` and `route-badge-labels` into **one symbol layer**:
  - an SDF circle icon, with `icon-color` `#0b0e14` and `icon-halo-color` set to the rating colour, halo 2.5;
  - `icon-allow-overlap: false` and `text-allow-overlap: false`;
  - `icon-padding: 4`;
  - `symbol-sort-key` = −(length × rating), so the best twisties keep their badge.
- In the same source, add **A and B placeholders**: a transparent 34 px icon, sort key lowest, `icon-allow-overlap: true`. They reserve space so that no badge lands under the HTML markers.
- Hidden badges come back when zooming in.
- **Acceptance:** on València → Los Santos max curves at the framed zoom, at 360×780, no badge overlaps A, B or another badge.

## 10. Build order (small slices, each with EN and ES shots at 360×780, 412×915, 884×1104 and 1440×900)

| # | Slice | Depends on |
| --- | --- | --- |
| 1 | Item 8 copy, headline grid, trip row split | — |
| 2 | Item 3: `SIDE_PANEL_QUERY` at 700, panel widths, sticky main button in the panel | — |
| 3 | Item 4: route colours, casing, overlay dimming, legend pill | `rating` on segments (routing session) |
| 4 | Item 8: badge collisions | 3 |
| 5 | Item 5: `routeDiff` (tested), ghost source, 250 ms step animation | Batch C item 4 |
| 6 | Item 1: sheet moved by transform, snap blocks, pinned footer, gestures, padding easing | Batch A items 1, 3, 9, 10 |
| 7 | Item 6: footer track line and 2 km threshold | 6; rider-safety confirms the threshold |
| 8 | Item 2: trip editor | 6; Batch A item 7 (keyboard inset) |
| 9 | Item 7: options chip placement and style | 8 |

**Owners:**

- frontend-engineer builds every slice.
- cartographer reviews slices 3 and 4.
- mobile-performance-engineer traces slices 5 and 6 on the Huawei.
- ux-designer reviews after slices 6 and 8.

## 11. What must not break

- The cinematic route with its glow over the dark hillshade, and the first draw-on.
- Instant offline town search.
- The slider's default stop and the "trade-off at a glance" bars.
- The rider-language twisty list with fly-to.
- The Spanish copy.
- The desktop panel's look.
- The folded content that riders praised: trip, slider, time and main button. It is now the **half** snap.
