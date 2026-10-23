# Plan: the twisty overlay without the launch freeze

Status: for the director's approval, nothing built. Owners: `routing` (export) and `app` (client). Date: 2026-10-14.
Source: Batch C item 1 of `reviews/2026-10-13-round-1.md`.

## Where we are

On the Huawei the overlay appears at 8.1 s and the main thread freezes for 1.28 s. The path today:

1. `App.svelte` fetches `twisties.json` (2.65 MB; 2.9 MB after the fun model's step c) and `parseTwisties` decodes 4,951
   polylines into 609,000 `[lon, lat]` arrays on the main thread.
2. After `load`, `setTwisties` builds 4,951 GeoJSON features and calls `source.setData(object)`, which structured-clones
   the whole object to MapLibre's worker.
3. The worker builds its geojson-vt index and cuts the tiles; the main thread receives them.

Only the overlay uses this data: the planner works from `graph.bin`. The UI needs the geometry, `rating` and the count.
`name`, `ref`, `lengthM` and `twist` are read only by the bench (`app/bench/main.ts`, `generate.ts`, `roads.ts`).

## What was measured (headless Chrome, 360×780 dpr 2, CPU throttled; the phone has not been used)

Isolated overlay on a blank style (same two layers as `layers.ts`), Spain at zoom 5, throttle 4×, median of 3:

| How the overlay gets its data | Longest main-thread task | Main-thread tasks over 50 ms (total) | Main-thread JS heap |
| --- | --- | --- | --- |
| Today: `setData(object)` | 640–680 ms | 880–940 ms | 118 MB |
| GeoJSON file, the worker fetches the URL | 410–430 ms | 470–480 ms | 80 MB |
| Pre-tiled vector tiles (z0–12) | 52–54 ms | 52–54 ms (the map's own start) | 11–15 MB |

Whole app at throttle 6×, 12 s after load (main-thread long tasks; the overlay's cost is the difference with "no overlay"):

| Variant | Longest task | Total long tasks | JS heap |
| --- | --- | --- | --- |
| No overlay at all | 352–369 ms | 1,024–1,076 ms | 37–38 MB |
| Today (JSON, decode, `setData(object)`) | 997–1,033 ms | 2,101–2,217 ms | 152 MB |
| `setData(url)` to a GeoJSON file | 646–674 ms | 1,664–1,689 ms | 65–66 MB |

The 6× figure for today's path (about 1.0–1.15 s) matches the 1.28 s seen on the Huawei, so 6× is the proxy to use.
The 430 ms task that remains with a GeoJSON URL is a message handler on the main thread (trace: `HandlePostMessage`),
which is MapLibre handling what the worker sends back; I did not find out which part. The tiled source has no such task.

## Options

### A. GeoJSON file, fetched by the worker

The pipeline writes `twisties.geojson` (`rating` only) and the source is `{type: 'geojson', data: url}`.
- Removes the main-thread decode and the structured clone (heap 118 → 80 MB); keeps a 410–430 ms task and the worker
  still parses and indexes everything before the first tile exists.
- File: 12.4 MB (3.45 MB gzipped, but the APK serves it uncompressed to the WebView, so 12.4 MB is what is read).
- Overlay is pixel-identical by construction (same source type, same tiler).
- Not enough on its own: the freeze halves, it does not go away.

### B. Pre-tiled vector tiles (recommended)

The pipeline cuts the overlay into `{z}/{x}/{y}.pbf` for z0–12 with the **same tiler and parameters MapLibre uses for its
GeoJSON sources**, so each tile holds what MapLibre would have cut at run time. The worker decodes only the tiles in view.
- Main-thread cost at launch drops to the map's own (52 ms vs 640–680 ms), heap by 100 MB, and nothing is parsed for
  tiles that are not on screen.
- Parameters, taken from MapLibre 6.14's `GeoJSONSource` (`_pixelsToTileUnits`, tile size 512): extent 8192,
  tolerance 6 (0.375 px), geojson-vt `maxZoom` 12 (at the last zoom geojson-vt does not simplify, so z12 keeps the full
  geometry; z13–18 overzoom it). The buffer is the only parameter I chose: 512 units (32 px of 512), enough for the
  widest layer (glow, 16 px wide plus 10 px blur); MapLibre's own 2,048 grows the files 74% for nothing visible.
- "No dropping": geojson-vt removes a line only when it collapses below the tolerance, exactly as it does today. The
  build asserts that all 4,951 features are in the z12 tiles.
- Cost: bigger than the polylines (see sizes) and 7,489 small files.

### B2. The same tiles as one PMTiles file

One file and a clean empty answer for tiles that do not exist, at the price of the `pmtiles` client (about 18 KB) and
either HTTP range support from Capacitor's local server (unverified) or reading the whole file into memory (5 MB).
Phase 7 already plans "twisty overlay as PMTiles" for the CDN, so this is where B goes then. Not now: it adds a
dependency and an unknown to solve a problem the directory of files does not have.

### C. Mitigations without a new export (fallback only)

Add the source empty and `setData` in chunks (epic roads first) so no single task passes ~200 ms. Not measured. It spreads
the freeze, does not remove any of the work, and keeps the 118 MB heap. Worth it only if B is refused.

Rejected: dropping the low ratings from the overview (breaks "never miss a great road"), a custom WebGL layer
(KISS), a larger worker pool (the cost is in the transfer and decode, not in tiling).

## Recommendation: B

### What the pipeline exports (`routing`, `gis-data-engineer`)

- `overlay/{z}/{x}/{y}.pbf`, one layer `twisties`, one property `rating` (integer 1–5), z0–12, uncompressed protobuf.
- Built by a Node script in `app/scripts/` (`geojson-vt` and `vt-pbf` as dev dependencies, plus the polyline decoder the
  app already has), run by `make data` after the Python step, reading `twisties.json`. Reason: it is the tiler MapLibre
  runs itself, so parity needs no argument; Python has no equivalent and `tippecanoe` is not installed and drops
  features by default.
- `meta.json` gets `overlay: { minzoom: 0, maxzoom: 12 }`; the app reads `twisties` (the count) from `meta.json` (239 B)
  instead of counting the array.
- `twisties.json` stays as the bench's input but is no longer shipped: write it to `data/build/` (git-ignored) and point
  the bench's `dataDir` there. Vite copies all of `app/public/data` into the APK, so leaving it there would ship 2.9 MB
  for nothing. (Alternative: keep it and accept the 2.9 MB; routing decides.)

### Sizes (today's data; step c adds about 9% twisties)

| Artefact | Size |
| --- | --- |
| `twisties.json` (today, shipped and fetched) | 2.65 MB |
| `overlay/` z0–12, buffer 512 | 5.9 MB raw, 5.25 MB when each tile is gzipped, 7,489 files |
| z12 alone | 2.3 MB, 4,905 files |
| Net change of the APK | about +3 MB (tiles in, `twisties.json` out; the APK deflates `.pbf`) |

By zoom (raw): z0–5 under 0.2 MB each, z8 0.33 MB, z10 0.79 MB, z11 1.27 MB, z12 2.33 MB. Dropping z12 would save 2.3 MB
but overzooms z11 (tolerance about 11 m instead of full detail): rejected, it would change the picture at street scale.

### What the app changes (`app`)

- The overlay's source and its two layers move into `mapStyle()` (before `peaks`), so the tiles start loading with the
  style and nothing waits for `load`; the layer ids and paint stay, so `setOverlayDimmed` is untouched.
- `App.svelte` stops fetching `twisties.json`; `setTwisties`, `parseTwisties` (kept for the bench only) and the `twisties`
  prop through `MapView` go away.
- The vector source declares `tileSize: 512` (the default for vector sources) and `maxzoom: 12`.

## Expected launch on the Huawei

Estimates from the 6× proxy; the real figures come from the phone.
- Main-thread freeze from the overlay: 1.28 s → below 0.15 s (the same 52 ms as the map's own start, scaled).
- The overlay no longer waits for the JSON, the decode and the worker: the z5 view needs 4 tiles (127 KB), so it should
  show within about 0.5 s of the style loading instead of 8.1 s. How much of the 8.1 s was the overlay and how much the
  rest of the launch (42 MB `graph.bin`, places) is not known: the phone trace tells.
- Memory: main-thread heap −100 MB (headless, whole app). The worker's share is not measured: with tiles it holds only
  the tiles in view instead of a geojson-vt index over 609,000 points.

## Parity: the overlay stays the same picture

Measured with a blank style, `fadeDuration: 0`, same camera, GeoJSON URL against the tiles (360×780 dpr 2), share of
pixels that differ by more than 24/255 in any channel:

| Zoom (place) | z5 (Spain) | z8 (Pyrenees) | z11 (Benasque) | z12 (Gredos) |
| --- | --- | --- | --- | --- |
| Tiles with MapLibre's parameters, buffer 512 | 0.001% | 0.061% | 0.061% | 0.059% |

For reference, the first try with extent 4096 and a finer tolerance (1) differed at the pixel level (1.2% at z5, 2.0% at
z8), which is why the parameters above are copied from MapLibre and not tuned. The 0.06% that remains is not
explained yet (a few pixels along tile edges or the sort order of equal ratings); it is not visible on the shots.
`object` against `url` is exactly 0 at all four zooms.

Gate for the build, in `app/bench` or a Vitest browser run: the same four camera positions plus z14 and z16 (not yet
measured: z13+ overzooms z12, where one coordinate step is about 0.9 m, about 1 px at z16) against the GeoJSON path,
accepting ≤ 0.1% pixels over 24/255 and no systematic offset. If z16 fails, the lever is a larger extent for z12 (16384,
a few percent more bytes), not another zoom level (each adds about 3× the files).

## How to measure

Headless (before and after, Mac): the scripts of this session (`overlay.mjs`, `ov.mjs`, `trace.mjs`, `diff.mjs`) in the
session scratchpad `…/f66d667c-…/scratchpad/{dem,ov}`; they should be committed with the build (`app/scripts/perf/`).
- Long tasks (`PerformanceObserver` `longtask`), JS heap, throttle 4× and 6×, 3 runs each.
- Trace of the longest task (`HandlePostMessage` and its children) when anything stays over 100 ms.
- Pixel diff at the six camera positions, GeoJSON path against tiles.

Huawei (after the director frees it; only `app.twisty.planner` is installed or cleared, never another
project's package):
- Cold start to overlay visible: `performance.mark` at the first `sourcedata` event of the overlay with a loaded tile,
  read over the devtools socket (`run.mjs` tooling); 5 cold starts, median.
- Longest main-thread task at launch (target < 100 ms from the overlay), drag trace unchanged, idle frames still 0.
- `dumpsys meminfo` and `dumpsys gfxinfo` before and after, including the WebView and its renderer process.
- The Capacitor server's answer for a missing tile: Chrome shows 404 without a MapLibre error; the WebView must do the
  same (unverified).
- APK size and `make data` time.

## Risks and open points

- Many files: 7,489 small assets in the APK and in `dist/`. Fine for the APK and `vite preview`; a CDN would want B2.
- A missing tile is a 404: no `error` event in MapLibre (checked), only console noise in the browser; to confirm on the
  WebView.
- z13+ fidelity (above) and the 0.06% residual.
- `twisties.json` out of `public/data`: needs the bench's `dataDir` and `docs/route-quality-bench.md` updated (routing).
- Phase 7: when the data moves to a CDN, the tiles become one PMTiles file (B2) with no change to the tiling.

## Order of work

1. `routing`: the script, `make data`, `meta.json`, `twisties.json` out of the shipped data, bench path. Gate: tile count
   and feature count asserted at build time.
2. `app`: the style and the cleanup. Gate: pixel parity at six camera positions, `npm test`, `npm run check`.
3. `app` with the Huawei: the phone measurements above, then land.

## As built (branch `overlay-tiles`)

Differences from the plan, found while building:
- **The last zoom is cut apart.** geojson-vt thins every line at the tolerance of its `maxZoom` before it cuts any tile, so
  z12 tiles cut with `maxZoom: 12` lose vertices (tolerance about 5 m) that MapLibre's GeoJSON path keeps; the first build
  showed spikes at hairpins (0.11–0.13% of pixels at z8 and z11). Zooms 0–11 are now cut like MapLibre cuts them (`maxZoom`
  18) and z12 is cut with tolerance 0, so deeper zooms stretch full-detail geometry. Parity at z5, z8 and z11 is 0 to
  0.003% of pixels; z12, z14 and z16 differ by 0.07%, 0.05% and 0.17%: a line shifted by under a device pixel (the z12
  GeoJSON tile is the thinned one). 6.3 MB, 7,489 tiles.
- **A missing tile is handled by the app, not by the host.** Vite's dev and preview servers answer an unknown tile path
  with the index page and a 200, so the plain `tiles` URL would feed HTML to the decoder. The source uses a
  `twisty-overlay://` protocol (`overlayProtocol.ts`): a 404 or an HTML answer is an empty tile, a network failure still
  fails. Unit-tested; the Capacitor server's answer is still to be seen on the phone.
- `twisties.json` moved to `data/interim/` (the pipeline's work dir), not `data/build/`; the bench reads it from there
  (`TWISTY_INTERIM` overrides). `meta.json` gains nothing: the max zoom is a constant shared by the script and the app
  (`lib/map/overlay.ts`).
- The parity gate is `make overlay-parity` (`app/scripts/overlay-parity.ts`, headless Chrome, six views); coarse zooms must
  stay under 0.01% of pixels, deep ones under 0.2%.
