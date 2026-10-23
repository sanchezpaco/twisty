# Plan: saved rides in folders (ROADMAP 18)

Status: approved by the director (2026-10-18), built on branch `saved-rides`. Owner: `app` alone (UI, copy, a storage module). Date: 2026-10-18.
Source: maintainer, 2026-10-17 ("the rider saves a ride they like and files it in folders they create, rename and
delete"); chosen as next with ROADMAP 16 on 2026-10-18.

Mockups (headless Chrome on `vite preview` of main 61ef806, the real app with the proposed pieces injected), in
`~/code/twisty/data/plan-mockups/`: `saved-1-ride-en` (the save button), `saved-2-sheet-{en,es}` (the save sheet),
`saved-3-toast-en`, `saved-4-start-{en,es}` and `saved-4b-start-full-en` (the entry on the start screen),
`saved-5-list-{en,es}` (folders and loose rides), `saved-6-folder-menu-en` (a folder and a ride's menu),
`saved-7-ride-{en,es}` (a saved ride opened), `saved-8-fold-open-en` (the side panel). The ux-designer's review is
folded in (section 8); the shots were taken again after it.

## Where we are

- Two stores exist, both `localStorage` in the app's WebView, both kept by the maintainer's phone today:
  - `twisty.trip` (`tripStorage.ts`): the ride just handed over, restored if Android kills Twisty within 2 h.
  - `twisty.trips` (`tripHistory.ts`): up to 5 recent trips (two ends, the slider stop), re-planned when tapped.
- Neither keeps a ride: a recent trip is planned again, so a data update changes it. A saved ride must not change.
- `RideOption` (`routing/ride.ts`) is everything the screen and the hand-offs use: times and distances, `segments` (the
  line drawn on the map and written to GPX), `twisties` (the summary and the map's numbered badges), `googleMapsUrl`,
  `coverageRoad`. Only `edges` ties it to a graph, and nothing on screen reads `edges`
  (`grep '\.edges' components lib/map` is empty).

## Design

### 1. What a saved ride is

A copy of the `RideOption` on screen without `edges`, plus who and where:

| field | why |
| --- | --- |
| `id` | stable key for rename, move, delete (`crypto.randomUUID()`) |
| `name` | the rider's; defaults to `Jaca → Benasque` (the row's second line tells two rides of a trip apart: day, time, km of curves) |
| `folderId` | a folder, or `null` for "Not in a folder" |
| `savedAt` | ms since the epoch |
| `from`, `to`, `via` | the trip's places as the history stores them (`label`, `position`); `via` is `[]` until ROADMAP 16 lands, so 16 adds stops without a new version |
| `dataAt` | `meta.json`'s `generatedAt`: "planned with the roads of 18 Oct" |
| `ride` | the option without `edges`; every `line` (segments and twisties) as an encoded polyline at 1e-6 (about 0.1 m, the precision GPX writes) |

A saved ride is never re-planned behind the rider's back: opening it shows exactly what was saved, Open in… sends the
saved Google Maps link and the saved line as GPX, Share sends the saved text. "Plan again with today's roads" is a
separate action (section 4).

**Size, measured** on main's data (Spain, the three baseline trips, fastest and twistiest option each):

| Trip | Points | JSON with plain lines | With encoded lines |
| --- | --- | --- | --- |
| Jaca → Benasque (+0 / +172 min) | 643 / 1,379 | 31 / 96 KB | 4 / 11 KB |
| Madrid → Granada (+0 / +170 min) | 951 / 1,971 | 37 / 121 KB | 4 / 14 KB |
| València → Los Santos (+0 / +97 min) | 421 / 968 | 17 / 67 KB | 2 / 8 KB |

At about 15 KB for the longest ride, 300 saved rides fit in 5 MB, the floor every WebView gives `localStorage`. So
`localStorage` it is, like the other two stores: no IndexedDB, no plugin. Encoding is a small pure function with
tests (round trip, negative coordinates, the 1e-6 step); it was measured at 1e-5, and 1e-6 adds about a fifth.

### 2. The store: its own key, and it only ever adds

New `savedRides.ts` (pure: add, rename, move, delete, folder create, rename, delete, parse, serialize) and its I/O in
the same file as the other two stores do (`loadSaved`, `saveSaved`). Key `twisty.saved`:

```json
{ "version": 1, "folders": [{ "id": "…", "name": "Pirineo", "createdAt": 0 }], "rides": [{ "id": "…", … }] }
```

The maintainer's data comes first:

- **`twisty.trip` and `twisty.trips` are not touched.** The module never reads or writes them, and a test checks that
  every operation writes `twisty.saved` and nothing else (a `localStorage` stub that records keys).
- **What cannot be read is kept as it is.**
  - An entry that does not parse (a future field the code does not know, a half-written ride) is kept as raw JSON and
    written back untouched. It is not shown and never dropped.
  - A store whose `version` is newer than the code (an older APK installed over a newer one) is shown read-only:
    nothing is saved over it, and tapping the save button shows a toast saying the saved rides were made by a newer
    Twisty.
  - Text that is not JSON at all is never overwritten. The first save after such a read moves the text to
    `twisty.saved.unreadable.<time>` first, a key of its own each time, never read back or written again.
- **Migrations add.** A later version reads version 1 and adds fields with defaults. It does not rename or drop
  anything: `via` is in version 1 for that reason.
- **Quota:** a save that does not fit (`QuotaExceededError`) changes nothing and says so in a toast ("Not saved: no room
  left on the phone for Twisty"). Nothing is evicted to make room.

### 3. Saving

- **The button**: a bookmark next to Share in the ride's footer (`saved-1-ride-en`). It is filled amber when this exact
  ride is saved: same places and the same Google Maps link.
  - Leaving the app stays the one big button, and saving sits with the other things done to this option (Share).
  - With an app chosen in Open in…, the footer has four buttons (main button, chevron, Share, Save).
    - The three square buttons shrink from 54 to 48 px.
    - The main button shows the app's name and ↗ alone ("Google Maps ↗"), which leaves it about 160 px at 360 px wide.
    - Rule for the build: the main button never ellipsises a usual app name.
- **The sheet** (`saved-2-sheet-*`) is a bottom sheet like Open in…: a title, the name field already filled, then the
  folders as chips (No folder, the folders by name, "+ New folder") and Save.
  - The name field does not take the focus: the keyboard would hide the chips and Save, and the usual save is one tap
    on the defaults.
  - With many folders the chip area stops at about three rows and scrolls.
  - The chip of the last folder used is preselected: riders file several rides in a row into the same one.
  - "+ New folder" turns into a text field in place. The new folder is created only when the ride is saved, so
    cancelling leaves no empty folder behind.
  - Folder names are trimmed and must be unique ignoring case and accents. A clash selects the existing folder
    instead of making a second one.
- **After saving**, the bookmark fills and a toast says "Saved in Pirineo · Undo" (`saved-3-toast-en`). The existing
  `Toast` gains an optional action button for this; it is the only toast with one. A toast with an action stands on the
  sheet's top edge, over the map, so it never covers the slider for its whole life.
- **A saved ride's button** opens the same sheet in edit mode: rename it, move it, or "Remove from saved".
- **No limit on the count**, only the quota above.

### 4. Finding and opening saved rides

- **The start screen** gets one row, "Saved rides · 9 rides in 2 folders", above Recent trips (`saved-4-start-*`).
  - It shows only once something is saved, so a new rider's start screen is unchanged.
  - Its tile is muted (raised surface, amber outline glyph), so it does not pull the eye from the A and B fields.
  - The row is a button with a chevron. The recent trips keep their place and their middle-snap cut.
- **The saved rides screen** (`saved-5-list-*`):
  - On the phone it takes the whole sheet, like the place search: back arrow, title, then the list.
  - In the side panel it replaces the details below the fields (`saved-8-fold-open-en`).
  - Folders come first, by name, each with its count, then "+ New folder", then the rides in no folder, newest first.
  - Each ride row starts with a 44 px drawing of its line in the twisty colours (an SVG from the saved line, simplified),
    then the name, then the day saved, the time and the km of curves. The rows line up with the folders' tiles, and
    two rides of one trip look different.
  - "+ New folder" in the list makes an empty folder at once. An empty folder says "No rides here yet. Save a ride and
    pick this folder."
- **A folder** (`saved-6-folder-menu-en`) lists its rides newest first.
  - The ⋯ in the title bar renames the folder or deletes it.
  - Deleting a folder **keeps its rides**: they move to "Not in a folder", and a toast offers Undo. A rider who wants
    them gone deletes them; one tap must never lose several rides.
  - Each ride's ⋯ offers Rename, Move to folder, Delete. Delete shows an Undo toast and asks nothing.
- **Opening a saved ride** (`saved-7-ride-*`) shows the ride as any ride is shown: the map, the A → B bar, the
  headline, the summary, the footer.
  - The camera frames it as it frames a planned ride (same fit and padding), and the line draws in with its numbered
    badges: the route is the hero here too.
  - The headline's chip shows the ride's own curves ("56 km of curves") in place of "+44 min / +36 km of curves":
    there is no fastest option to compare with, and the curves stay Twisty's main number.
  - The slider's place holds one line: the bookmark glyph, "Pirineo · 12 Oct" (the folder and the day; "Saved" with
    no folder), and a quiet text button "Plan again". Its aria label says the rest: "Plan again with today's roads".
  - Plan again fills the fields (and stops, with 16) and plans as usual. The line gives way to the slider in place.
    The slider opens on the option whose `extraS` is nearest to the saved one. The saved ride is not changed; the
    new ride's bookmark is empty unless the new plan is the same ride (same link through the same points).
  - In the side panel the fields stay in view: changing one starts a new plan, as Plan again does.
- **Back** (the system back button and the arrow) goes ride → folder → saved rides → start, through the existing
  `onBackButton`.

### 5. Privacy

- A saved ride stays in the app's own storage: nothing is sent anywhere, the same promise as the history (PRD 5.3).
- **"My location" is the one difference.** The history keeps only a `here` flag for it. A saved ride cannot: its line
  starts at the rider's position.
  - Proposed: the start is kept as the town it lies in (`describe(position)`, e.g. "València"), with its position.
  - The save sheet shows that name in the default ride name, so the rider sees what is kept and can rename it.
  - Opening the ride and Plan again use the saved start: it is the ride the rider chose to keep.
  - This is a decision for the director: the alternative, dropping the first and last kilometre of the line, makes
    the GPX and the Google Maps link wrong.
- Android Auto Backup is on (`allowBackup="true"`), so the store is backed up with the app's data like the other two.
  Nothing changes there.

### 6. Code

| file | change |
| --- | --- |
| `lib/savedRides.ts` + test | the store (section 2), pure operations, parse and serialize, the key guard test |
| `lib/polyline.ts` + test | encode and decode at 1e-6 |
| `lib/savedRide.ts` + test | `RideOption` ⇄ saved ride (drop `edges`, encode lines; back with `edges: []`) |
| `components/SaveRideSheet.svelte` | the sheet (section 3) |
| `components/SavedRides.svelte` | the list, a folder, the menus (section 4) |
| `components/RideActions.svelte` | the bookmark button; with four buttons, the app's name alone and 48 px squares |
| `components/Toast.svelte` | an optional action (Undo), placed on the sheet's top edge |
| `components/RideThumb.svelte` | the 44 px drawing of a saved line (SVG, simplified, twisty colours) |
| `components/RideHeadline.svelte` | the chip with the ride's own km of curves for a saved ride |
| `components/Panel.svelte` | the entry row; a `screen` state (start, saved list, folder, saved ride) next to `editorOpen` |
| `App.svelte` | the saved store as state; open a saved ride (options = [it], no slider); Plan again |
| `lib/i18n/en.ts`, `es.ts` | the copy below |

- A saved ride on screen is a one-option ride with `saved: true`. MapView, RideSummary and RideActions take it as it
  is. RideSlider is not drawn, and the headline hides the extra-time chip.
- No change to the planner, the worker, the pipeline, Android or the data.
- A saved ride handed over (Open in…, Share) writes nothing to the recent trips or the restore store: it is kept already.
- Section 5 decided by the director: the start from "My location" is kept as its town and position, the town in the
  default name.

As built, checked in headless Chrome on `vite preview` (phone and unfolded Fold, EN and ES; shots in
`~/code/twisty/data/saved-rides-shots/`): saving writes `twisty.saved` only, `twisty.trip` and `twisty.trips` stay
byte for byte, the Jaca → Benasque ride takes 9 KB, the opened ride is framed (zoom 7.6, as planned), and Plan again
opens the slider on the same +44 min option.

Tests:
- Store round trip.
- Unknown entries and a newer version kept as they are.
- Non-JSON text moved to `twisty.saved.unreadable` before the first save.
- The key guard.
- Deleting a folder keeps its rides.
- Unique folder names.
- Polyline round trip.
- A saved ride gives back the same GPX and Google Maps link as the ride it was saved from (`gpxTrack` on both,
  compared).

### 7. Copy (`en.ts` is the source)

| key | en | es |
| --- | --- | --- |
| `saved.button` (aria) | Save ride | Guardar ruta |
| `saved.edit` (aria) | Saved: rename, move or remove | Guardada: cambiar nombre, mover o quitar |
| `saved.sheetTitle` | Save this ride | Guardar esta ruta |
| `saved.name` | Name | Nombre |
| `saved.folder` | Folder | Carpeta |
| `saved.noFolder` | No folder | Sin carpeta |
| `saved.newFolder` | New folder | Nueva carpeta |
| `saved.save` | Save ride | Guardar ruta |
| `saved.savedIn(folder)` | Saved in {folder} | Guardada en {folder} |
| `saved.savedLoose` | Saved | Guardada |
| `saved.undo` | Undo | Deshacer |
| `saved.heading` | Saved rides | Rutas guardadas |
| `saved.summary(rides, folders)` | {n} rides in {m} folders | {n} rutas en {m} carpetas |
| `saved.folders` | Folders | Carpetas |
| `saved.loose` | Not in a folder | Sin carpeta |
| `saved.rides(n)` | {n} rides / 1 ride | {n} rutas / 1 ruta |
| `saved.rename` | Rename | Cambiar nombre |
| `saved.move` | Move to folder | Mover a carpeta |
| `saved.delete` | Delete | Borrar |
| `saved.remove` | Remove from saved | Quitar de guardadas |
| `saved.deleteFolder` | Delete folder (keeps its rides) | Borrar carpeta (conserva sus rutas) |
| `saved.where(folder, day)` | {folder} · {day} | {folder} · {day} |
| `saved.whereLoose(day)` | Saved · {day} | Guardada · {day} |
| `saved.planAgain` | Plan again | Planear de nuevo |
| `saved.planAgainLabel` (aria) | Plan again with today's roads | Planear de nuevo con las carreteras de hoy |
| `saved.curves(km)` | {km} km of curves | {km} km de curvas |
| `saved.emptyFolder` | No rides here yet. Save a ride and pick this folder. | Aún no hay rutas. Guarda una y elige esta carpeta. |
| `saved.full` | Not saved: no room left on the phone for Twisty | No se ha guardado: no queda espacio para Twisty en el móvil |
| `saved.newer` | These rides were saved by a newer Twisty | Estas rutas las guardó un Twisty más nuevo |

Spanish uses "planear" in the new keys, as the history does (es.ts mixes it with "planificar" elsewhere).

### 8. Review

One ux-designer pass (2026-10-18) on the plan and every mockup. No blocker. Everything was taken, and the shots were
taken again:

| Rank | Finding | Taken as |
| --- | --- | --- |
| Major | An opened saved ride showed Spain, not the route | It is framed and drawn like a planned ride (section 4). The first shot had caught a camera that had not moved yet. |
| Major | The headline lost all curve information | The chip shows the ride's own km of curves (section 4) |
| Major | The band and a full-width Plan again competed with the ride, and the Spanish button overflowed | One line, folder and day, a quiet "Plan again" (section 4) |
| Major | Four footer buttons ellipsised "Open in Google Maps" | The app's name and ↗ alone, 48 px squares, never ellipsised (section 3); the footer was kept over the A → B bar, which 16's stops also need |
| Minor | The Undo toast covered the slider | Toasts with an action stand on the sheet's top edge (section 3) |
| Minor | Text-only ride rows | A drawing of the line leads each row (section 4) |
| Minor | "+44 min" in the default name goes stale | The default is "Jaca → Benasque" (section 1) |
| Minor | The keyboard would cover the save sheet; many folders | No focus on the name; the chips scroll (section 3) |
| Minor | Empty folder, the newer-store note, editing a saved ride's field | Copy and rules added (sections 2 and 4) |
| Minor | The amber start tile pulled the eye; the Spanish shots showed English; "planear" vs "planificar" | Muted tile; the shots were retaken fully in Spanish (the scripts set the wrong key before); "planear" |

## Not in this plan

- **Export and import** (a folder as GPX files, a backup file). Saved rides live and die with the app's data; Auto
  Backup covers a new phone. Worth an item when a rider asks.
- **Sharing a folder**, sync, accounts: never (PRD: no backend).
- **Restoring a saved ride after Android kills the app.** It is one tap from the start screen; `twisty.trip` stays as it
  is.
- **Sorting and search in the list.** Newest first is enough until someone has hundreds.

## Document changes (the director keeps them)

- ROADMAP 18: the plan's path and, when it lands, the line.
- PRD, Trips row: "Saved rides, in folders the rider names, kept on the device as they were saved; planning one again is
  a separate action."
