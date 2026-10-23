# Plan: a trip history instead of the auto-restored trip

Status: for the director's approval, nothing built. Owner: `app` (UI, copy) with a small storage module. Date: 2026-10-15.
Source: maintainer, 2026-10-15 ("the app should not open with the last ride already planned; a history of recent trips
is preferred").

Mockups (headless Chrome on `vite preview` of this branch's build, real start screen with the section injected), in
`~/code/twisty/data/trip-history/`: `b-{phone360,foldopen}-{es,en}.png` is the proposal; `a-*` is the first version (filled
cards, Clear all in the heading line), kept for comparison; `none-*` is today's start screen. One `ux-designer` opinion
was taken on `a-*` and is folded in (section 4, "What the review changed").

## Where we are

- `tripStorage.ts` keeps one trip (`twisty.trip`: both ends, the tracks switch, the slider stop). `App.svelte` writes it on
  every change and reads it at launch, so the app always opens on the last ride, planned again (`restoredKey`,
  `restoredSelected` keep the slider stop). It exists for one case: Android kills Twisty while the rider is in another
  app, and coming back must not lose the ride.
- The start screen (`Panel.svelte`, `.intro`) is the fields, the Options chip, then the title, a paragraph, the road count
  and the language switch.
- "Open in…" hands the ride over in `RideActions.svelte` (`openIn(target)`), the one place where a ride leaves Twisty.

## Design

### 1. Two stores with two jobs

| | what | lives | holds |
| --- | --- | --- | --- |
| **handed-over ride** (`tripStorage.ts`, key `twisty.trip`, as today plus `at`) | the ride the rider just opened in another app | until the next launch after the restore window | both ends with coordinates, tracks switch, slider stop, `at` |
| **history** (new `tripHistory.ts`, key `twisty.trips`) | trips handed to a navigation app, and the last ride left on screen | until removed | up to `HISTORY_MAX = 5` entries, newest first, at most one of them never handed over |

Launch opens clean (start screen, no ride) unless the handed-over ride is younger than `RESTORE_WINDOW_MS = 2 h`; then it is
restored exactly as today (planned again, same slider stop). Older: deleted at launch. So Android killing the app while the
rider navigates still works, and a rider who comes back the next day sees the start screen.

The handed-over ride is written when the rider hands a ride over (`onhandover` from `RideActions`), not on every edit.
App.svelte stops saving on each change: this also removes the effect that rewrote the trip on every slider move.

### 2. What counts as "a trip" (decided by the director, 2026-10-15)

Two moments write the history:

- **Every hand-off** (Open in…: Google Maps, a GPX app, the share sheet, the desktop download) records the trip as a normal
  entry (`handed`). The same trip handed before is promoted and moved to the top, not repeated.
- **The ride on screen when the app goes to the background or closes** (`visibilitychange` to hidden, `pagehide`) is recorded
  as a never-handed entry. The list holds **at most one** such entry: a newer unridden ride replaces it, and handing it off
  promotes it. Why: a rider who plans at 22:00 and leaves at 08:00 is past the 2 h restore window and handed nothing over.
  A trip that was handed over before and is on screen again stays `handed` and moves to the top with its new stop.

Planning alone writes nothing, so exploring destinations does not evict what was ridden; only the last ride left on screen
does, and only its own slot. Both ends must be set. Same trip = same two ends (label and position) in the same direction;
B → A is another trip. The tracks switch and the slider stop are not part of the identity: they are updated with the date.

### 3. Privacy

PRD §5.3 says location never leaves the phone and there is no tracking. The history is `localStorage` in the app's own
WebView: nothing is sent anywhere. One rule on top: **"My location" is never stored with coordinates in the history**
(they would be the rider's home or hotel). A history entry whose start was the rider's position keeps only a flag
`here: true`; tapping it asks for the position again (existing `locate()`), and the label is the current language's
"My location". The handed-over ride, which must be restored exactly, does keep the coordinates, but only for the restore
window, and it is deleted at the first launch after it. The rule is the same for the never-handed entry. Places picked by search or long-press
keep label and position (they are towns and map points, as today).

### 4. The start screen

"Recent trips" sits between the Options chip and the intro, only on the start screen (no ride, no error, not planning), on
the phone sheet and in the side panel. It is a shortcut list, quieter than the fields: **flat rows with hairline separators,
no card fill**, names in the normal text colour at 14.5 px. Each row is one button and a remove button:

- Line 1 `A → B`, one line; A takes at most 42 % and B the rest, each ellipsised, so B (where the rider goes) keeps the
  most text ("València → Los Santos de Maimona" fits at 360 px). A start that was the rider's position shows the locate icon
  instead of the words (aria says "My location"); the full names are in `title` and the aria label.
- Line 2 the date (Today / Yesterday / `12 Oct`), plus "with tracks" in the tracks colour when the switch was on.
- Row 56 px, remove button 44 px wide. Tap the row = both fields filled and the plan starts; the slider opens on the stop the
  rider had chosen (the existing `restoredKey` logic, generalised to "the stop to open on for this trip"). A "my location"
  start asks for the position again (`locate()`); if it is refused, B is filled and A takes the focus, not a silent failure.
- "Clear all" is a quiet text link **below the last row** (out of the thumb zone above row 1). No confirmation and no undo
  toast: five entries, replanning is one tap and the app has no toast infrastructure today (see open question 4).
- While the fields are being edited (search open) the section is hidden: the suggestions take the screen.
- The intro **shrinks when there is a history**: the title and the paragraph are onboarding for someone who has not ridden
  yet and go; the road count with the map hint and the **language switch** stay as a footer (the language switch lives in
  the intro, so it must not disappear). With no history the start screen is exactly today's.
- Phone sheet: the middle snap keeps its height (the map is the hero); it shows about three rows with the fourth peeking as
  a drag cue; the other two and the footer are one drag up. The side panel shows all five and the footer
  (`b-foldopen-*.png`). The sheet moved ~37 px in the injected mockup compared with `none-phone360`; I could not tell an artefact
  of the injection from the real snap and will check it with the built component.

#### What the review changed

Taken: flat rows instead of cards (they outranked the empty fields), Clear all below the list, the intro collapse, the
42 % rule for A, the locate icon, the aria copy. Not taken: the undo toast (open question 4).

### 5. Code

- `tripHistory.ts` (pure): `addTrip(list, trip, now)` (dedupe, newest first, cap), `removeTrip`, `parseHistory` (anything odd
  means empty), `serialize`, `isRestorable(stored, now)`; `HISTORY_MAX` and `RESTORE_WINDOW_MS` named at the top. Tests next
  to it, like `tripStorage.test.ts`.
- `tripStorage.ts` gets `at`; `loadTrip(now)` returns the trip only inside the window and removes it otherwise. The old
  `twisty.trip` written by the previous version has no `at`: it is removed at the first launch, nothing is carried over.
- `App.svelte`: no restore effect; `handedOver(trip)` called from `RideActions` on success saves both stores; `pickTrip(entry)`
  sets `from`, `to`, `includeTracks` and the stop to open on.
- `Panel.svelte`: the section, a small `RecentTrips.svelte` component (rows, remove, clear all), `i18n` keys below.
- No Android change; no data change; no effect on planning or the bench.

### 6. Copy (`en.ts` is the source)

| key | en | es |
| --- | --- | --- |
| `history.heading` | Recent trips | Viajes recientes |
| `history.clearAll` | Clear all | Borrar todo |
| `history.open(from, to)` (aria) | Plan {from} to {to} | Planear de {from} a {to} |
| `history.remove(from, to)` (aria) | Remove the trip from {from} to {to} | Quitar el viaje de {from} a {to} |
| `history.today` | Today | Hoy |
| `history.yesterday` | Yesterday | Ayer |
| `history.withTracks` | with tracks | con pistas |

Other dates use `Intl.DateTimeFormat` with `es` and `en-GB` (plain `en` would print Oct 12), day and short month. The start's name for the rider's position is
the existing `places.myLocation` (My location / Mi ubicación).

## Document changes (the director keeps them)

- **PRD §5.1**: new row *Trips*: "The app opens on the start screen. The trips the rider has handed to a navigation app are
  kept on the device (up to 5, no coordinates for 'My location') and listed as 'Recent trips': one tap plans a trip again.
  A ride handed to another app is restored if Android closes Twisty within 2 hours." PRD user story 1 or 3 unchanged. §5.3:
  one clause, "the trip history never leaves the device".
- **ROADMAP**: new Phase 3 item `[ ] Trip history instead of the restored trip (maintainer, 2026-10-15;
  plans/2026-10-15-trip-history.md)`; the Phase 6 item "A restored long trip …" keeps its text (the restore stays for the 2 h
  case).

## Decisions

Decided by the director (2026-10-15): record on every hand-off and the one ride left on screen (section 2); five entries; the
2 h restore window stays (the history covers anything longer with one tap); no undo toast (it would be the app's first toast
to protect a five-row list that is one tap to rebuild; Clear all sits below the list instead).
