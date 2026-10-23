# Plan: tracks off until the off-road update (ROADMAP Next up 24)

Status: approved by the director (2026-10-18), built on branch `tracks-off`. Owner: `app`.

## Why

The maintainer's call (2026-10-18): tracks wait for a dedicated off-road update. Today the "Include tracks" switch is
the only thing under the Options chip, and `tracks.bin` (140.5 MB in today's data, loaded only when the switch is on)
ships inside every APK. With the switch hidden, no rider can ever ask for it, so the APK carries it for nothing.

## What

**One switch for the whole app.** `app/src/lib/offRoad.ts` exports `TRACKS_OFFERED = false`, with a comment pointing
at Phase "Off-road". Everything below reads it, so the off-road update flips one constant instead of putting back
deleted UI. The planner, the worker, the ride summary's tracks lines, the GPX call to action and the pipeline stay as
they are on main (the roadmap's words). They are not dead code: they are reachable again by that one constant, and
they keep their tests.

- **Panel:** the `.options` row with the `OptionsChip` is not rendered. The chip holds nothing else today, so it goes
  as a whole, with no empty chip left behind. The component and its copy stay for the off-road update.
- **App:** `includeTracks` is always `false` while tracks are not offered. That holds for a fresh trip, a restored
  `twisty.trip` and a recent trip picked from history: `TRACKS_OFFERED && trip.includeTracks`. A rider who saved a
  trip with tracks gets the same trip on roads. The slider opens on the default stop, because the stop chosen with
  tracks belongs to another set of options (the trip key already includes `tracks`).
- **Recent trips:** the "· with tracks" tag only shows while tracks are offered, because the trip is now planned
  without them. The stored history is never rewritten: the flag is kept for the off-road update.
- **Build:** a small Vite plugin in `vite.config.ts` removes `data/tracks.bin` from `dist/` after the bundle when
  `TRACKS_OFFERED` is false. The config imports the constant (`../src/lib/offRoad.ts`; `tsconfig.node.json` allows the
  extension), so there is still one switch. `make apk` and `make web` both build through it, so neither the APK nor a
  web deploy carries the file. The dev server still serves `public/data`, but nothing asks for the file.
- **Pipeline and data:** unchanged. `make data` still writes `tracks.bin`, and the bench and the off-road work need it.
  `check-data` never required it.

**Copy:** no new strings. The tracks strings stay in `en.ts`/`es.ts` for the off-road update.

**Docs (in the branch):** README "Highlights" drops the tracks bullet. "How it works" says the tracks layer is built
but not shipped until the off-road update. The PRD's 5.1 "Tracks" row, user story 7 and the APK size are the
director's to edit; proposed text goes with the hand-back.

## Not in this plan

- Deleting the tracks UI or the planner's tracks layer: the roadmap keeps them for Phase "Off-road".
- Splitting `make data` so the pipeline skips `tracks.bin`: that is routing's code. Skipping it would save build time,
  not APK size.
- The Options chip as a home for future settings (detour budget, curve character): it comes back when it has something
  to hold.

## Checks

- **Tests:**
  - The panel renders no options chip. As built, this is checked in headless Chrome on the real DOM, because the
    panel reads `window` and cannot render under SSR.
  - A restored trip and a history pick with `includeTracks: true` plan with `includeTracks: false`. Pure logic,
    moved into a function `App.svelte` calls, so it can be tested without a DOM.
  - Recent trips: no "with tracks" tag.
- **Build:** `unzip -l dist/twisty-debug.apk | grep tracks.bin` finds nothing. APK size and the installed size on the
  phone, before and after (today's debug APK is 112 MB on disk).
- **Network (headless, vite preview):** a trip planned after restoring one saved with tracks makes no request for
  `tracks.bin`, and the worker never stacks the layer.
- **Shots (headless, Huawei viewport 360x780 dpr 3, and the Fold sizes):** start screen, the editor open, a short trip
  (Jaca -> Benasque) and a long one (Madrid -> Granada) folded and expanded. Removing the chip frees a row, so the
  sheet's folded height and the peek of recent trips must still look right. Reviewers: `ux-designer` on the shots,
  `rider-safety` on the ride summary (no tracks warning can show without tracks).
- **Gates:** the three, on the rebased head.
- **Huawei (when the director hands it over):** install the new APK over the old one. Check that a trip saved with
  tracks on the phone comes back on roads, and note the installed size.
