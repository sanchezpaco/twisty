# Plan: map styles, a satellite view and a light map (ROADMAP Next up 15)

Status: revision 2, with the review round folded in. Reviewed by `ux-designer`, `cartographer` and
`data-policy-reviewer` (ranked list and full reports: `data/map-styles-spike/reviews/`, git-ignored). The director approved
the direction and took the decisions listed at the end. Nothing of slice 2 is built. Owner: `app` (`frontend-engineer`;
the load numbers are for `mobile-performance-engineer`). Date: 2026-10-17. Source: the maintainer, who wants a satellite
view and a normal light map besides the dark style, chosen by the rider, "to see the roads they will take".

Measured facts below come from the live services on 2026-10-17 (curl, headless Chrome) and from a throwaway spike with
the IGN orthophoto layer under the current route (`data/map-styles-spike/`, code discarded). No phone was used.

## 1. The recommendation in one screen

- **Three styles: Dark (today), Light, Satellite.** One map, one style document, one set of route and overlay layers. The
  rider switches from a layers button under the 3D chip; the choice is remembered; Dark stays the default and is
  byte-for-byte what it is today.
- **Satellite = IGN PNOA orthophotos** (`https://www.ign.es/wmts/pnoa-ma`), CC BY 4.0, free, keyless, CORS `*`, one-year
  cache headers. Reviewed: a published free app may use it directly with no agreement; the one condition is a dated,
  **always-visible** credit at the map's foot. Satellite stays free (IGN's notice forbids access "con contraprestación").
- **PNOA starts at tile level 13, which is map zoom 11.5.** In `GoogleMapsCompatible` level 13 is 1:68,247 and level 12
  is 1:136,495. MapLibre asks for 256 px tiles at level round(zoom + 1) (measured in the slice 2 network log: z11.4 asks
  level 12, z11.6 level 13), so trip views below z11.5 show **Sentinel-2 at 10 m** and closer ones orthophotos. The
  satellite is a close-zoom feature; at trip zoom it is a coarse but real picture of the land. This shapes the design
  (sections 5 and 6).
- **Light = our own light palette over the OpenFreeMap vector tiles we already load.** No new source, host, credit or
  bytes. It must not copy `positron`/`bright`/`liberty` colours or structure (OpenMapTiles' styles carry a design credit).
- **Switching never calls `setStyle`.** A theme is a table of paint values and layer visibilities applied with
  `setPaintProperty`/`setLayoutProperty`, with a ~300 ms style transition so Dark and Light cross-fade.
- **Chrome stays dark in every style** (director). Two exceptions that are not "following the theme": a top scrim on Light
  and Satellite for the status bar, and a softer map-overlay shadow on Light (`--map-shadow`).
- **Slice 1 (theme module, Light, the switch) ships first and needs nothing new from any third party.** Slice 2
  (Satellite) waits for the director's go and the Huawei measurement.

## 2. Sources, terms and attribution

### 2.1 Satellite

| Candidate | Free, no key | Terms | Verdict |
| --- | --- | --- | --- |
| **IGN PNOA + Sentinel-2 at small scales** (`www.ign.es/wmts/pnoa-ma`, layer `OI.OrthoimageCoverage`, `GoogleMapsCompatible`, z0-19, JPEG) | Yes | CC BY 4.0 under Orden FOM/2807/2015 (art. 5.2 for services: "de utilización libre y gratuita, siempre que se mencione el origen y propiedad de los datos"; use implies accepting the licence). Capabilities: `Fees: No se aplican condiciones`, `AccessConstraints: CC BY 4.0 scne.es`. No volume limit published; served through CloudFront. | **Recommended** |
| IGN `ign-base` / `mapa-raster` (MTN) | Yes | Same CC BY 4.0 | Not satellite; raster, Spanish-only labels, heavier. Not used for Light. |
| ICGC (Catalonia), Esri World Imagery, EOX Sentinel-2 cloudless, NASA GIBS, Mapbox, MapTiler, Google, Bing | - | Regional only / needs a key / unclear or non-commercial licence / 10-250 m / contract | No |

Measured (IGN): `Access-Control-Allow-Origin: *`; `Cache-Control: max-age=31536000`; JPEG 256 px tiles of 11-21 KB at
110-190 ms; the capabilities abstract says PNOA is "visible a partir de una escala aproximada 1:70.000. Para escalas menores
se visualizan las imágenes de satélite Sentinel2 de 10 metros", with MODIS (NASA) as world background and Melilla from
Pléiades Neo © Airbus DS (2022).

**The credit, verbatim (reviewed).** The licence asks for the coupled-data formula, dated, "visible junto con los datos, de
forma legible y a pie de mapa". The ortho source's `attribution`:

`<a href="https://pnoa.ign.es/">PNOA</a> 2022-2025 CC-BY 4.0 <a href="https://www.scne.es/">scne.es</a> · MosaicoSentinel2 2018-2026 CC-BY 4.0 <a href="https://www.ign.es/">ign.es</a>, contains modified Copernicus Sentinel data`

- It does not fit one line on 360 px, so it is **split into two sources by zoom** on the same URL: a layer with
  `maxzoom: 11.5` carrying the Sentinel half, a layer with `minzoom: 11.5` carrying the PNOA half; MapLibre shows only the
  one in view because a source counts as used only while a layer of it is visible at the current zoom. The PNOA half
  (189 px) fits one line; the Sentinel half (447 px) cannot be shortened and takes two lines on a phone, so the box is
  two lines high on phones whenever satellite is on and the route fit does not jump with the zoom.
- **Tilted in 3D** the far half of a close view is Sentinel-2, so with terrain on at zoom 11.5 and above the line carries
  both formulas. The PNOA source has no minimum level, or the far field would be dark fills.
- The line follows the zoom as it changes (a flip at 11.5 during a pinch, not at the end of it); its links open in a new
  window like the credits sheet's.
- The date ranges live in **one named constant** next to the source, with a comment naming the IGN records to re-check when
  IGN announces an update (RSS `https://www.ign.es/ign/rss`).
- **It is not inside the collapsed (i) control.** While the satellite theme is active a credit line stays open at the
  map's foot, above the sheet (riding `--sheet-covered`), 10 px, muted, never collapsible; the rest of the compact control
  stays as today. A unit test asserts the line is in the DOM when the theme is `satellite`.
- MODIS is CC0 (credits sheet only). Melilla's Airbus line goes in the credits sheet.

**Credits sheet, new block "Satellite view" / "Vista de satélite"** (EN is the source; text from the review):

> Aerial orthophotos: PNOA 2022-2025 CC-BY 4.0 scne.es (Plan Nacional de Ortofotografía Aérea; Instituto Geográfico
> Nacional, regional governments and CNIG, Sistema Cartográfico Nacional). At small scales: MosaicoSentinel2 2018-2026
> CC-BY 4.0 ign.es, containing modified Copernicus Sentinel data. Melilla: Pléiades Neo © Airbus DS (2022). World
> background: NASA MODIS. Shown unmodified from the IGN tile service.

ES: "Ortofotos aéreas: PNOA 2022-2025 CC-BY 4.0 scne.es (Plan Nacional de Ortofotografía Aérea; Instituto Geográfico
Nacional, comunidades autónomas y CNIG, Sistema Cartográfico Nacional). A escalas pequeñas: MosaicoSentinel2 2018-2026
CC-BY 4.0 ign.es, que contiene datos modificados de Copernicus Sentinel. Melilla: Pléiades Neo © Airbus DS (2022). Fondo
mundial: NASA MODIS. Se muestran sin modificar desde el servicio de teselas del IGN." Links: `pnoa.ign.es`, `scne.es`, the
Copernicus Sentinel legal notice. README Credits gets the same EN lines.

**Imagery stays unmodified.** `raster-brightness-*`, `raster-contrast`, `raster-saturation`, `raster-hue-rotate` stay at
their defaults. Changing any of them makes the layer a derived work ("Obra derivada de" prefix, and "Shown unmodified"
would have to go). Legibility comes from casings. The thumbnail in the style card is drawn, or, if it uses an IGN crop,
the credits block adds "Style picker thumbnail: PNOA CC-BY 4.0 scne.es".

**Other policy points carried by the plan** (director's items, not code): the privacy policy must name the tile hosts
(OpenFreeMap via Cloudflare, Terrain Tiles on AWS, and IGN via CloudFront only if satellite is chosen) and PRD 5.3
("Location never leaves the phone") needs the tile-area exception; Phase 7 offline packs never prefetch IGN tiles without
CNIG's answer (prefer their download centre); satellite stays free. **Email to CNIG: not a gate** for slice 2 while the
strict dated visible credit ships; whether to send it is the maintainer's call and nobody sends it until they say.

### 2.2 Light

Our own light palette over the `openmaptiles` source already in the style. Credits: nothing new (the TileJSON brings
OpenFreeMap, OpenMapTiles and OSM). Only if colours or structure were copied from OpenMapTiles' `positron`, `bright` or
`liberty` would "Map design © OpenMapTiles / CARTO" be needed; the palette below is the cartographer's own.

## 3. How it fits in the code

- `lib/map/theme.ts` (pure, tested): `MapTheme` (`'dark' | 'light'` in slice 1, `'satellite'` in slice 2); one table per
  theme for the base layers (land, wood, grass, urban, water, roads by class, borders, labels and halos, sky and fog,
  hillshade) and for what is drawn over them (route and track colours and casings, overlay ramp and casing, legend and
  badge ramp). `themePaint(theme)` and `themeLayout(theme)` return the values; the dark table equals today's `MAP_COLORS`,
  `ROUTE_COLORS` and `RATING_COLORS` (tested).
- `mapStyle(theme)` builds the document in the stored theme, so a rider who chose Light never sees a dark frame. The
  `.map` container background is the stored theme's land colour before the style loads.
- `applyTheme(map, theme)` in `MapView` sets about 50 properties over the table, including the route layers that
  `addRouteLayers` adds after load; `setOverlayDimmed` reads its dimmed opacities from the theme (the light overlay casing
  would vanish at the dark theme's 0.05). `routeRenderer` and the route sources are untouched. The style `transition` is
  ~300 ms so colours cross-fade.
- State: `lib/map/themeState.svelte.ts` with the stored choice (`twisty.mapTheme`, read in a try/catch, dark by default);
  a `data-map-theme` attribute on the root drives `--map-shadow` and the top scrim.
- **Marker colours and ramp sharing.** The badge halo (`layers.ts` `icon-halo-color`) and the legend pill take the theme's
  ramp. The sheet (`RideSummary`, `RideSlider`, the twisty list) keeps the dark ramp on dark chrome; the light ramp is
  hue-matched so rating 3 reads as the same class in both.

## 4. How the switch looks

A round layers button (stacked-layers icon, `aria-label` "Map style") under the 3D chip in the map's top-right column.
The legend pill and both right-column controls are **44 px tall** with the same right edge and an 8 px gap (the 3D chip
was 36 px). Tapping opens the styles, three tiles (two in slice 1), each a drawn thumbnail of one place (a Pyrenees
hairpin) with a route stroke in that theme's colours, and a label. Where they open depends on the layout, because on a
phone a card under the button hid the middle of the route the rider was comparing styles on (slice 1 review):

- **Phones and the Fold cover (below 700 px): a compact strip to the left of the button**, at the button's height, at most
  52 px tall (28 px swatch with the label beside it). Three tiles fit beside the button on the 344 px cover screen
  (344 - 16 - 44 - 8 = 276; the strip of three measures 241 px). It sits in the band the route fit keeps clear: the
  phone fit margin at the top is 132 px, the strip's bottom (116 px) plus a pin's radius, so a pin at the top of a framed
  route stays visible under it.
- **Side-panel layouts (Fold unfolded, desktop): the card under the button, right-aligned to it**, 64 px thumbnails, where
  it does not cover the route.

- **The style applies live and the card stays open**, so styles can be compared; it closes on an outside tap, a map pan,
  a sheet drag, Escape or Back (the `onBackButton` stack).
- `role="radiogroup"`: arrow keys move and apply, focus lands on the active tile when the card opens and returns to the
  button when it closes, a hover tooltip on desktop; tiles are at least 44 px.
- Thumbnails: three small SVG/CSS drawings of the same hairpin (about 2-3 KB each), checked by the cartographer. No
  shipped IGN crop (so no credit line is needed for the picker).
- Copy (EN source, ES translates): "Map style" / "Estilo del mapa", "Dark"/"Oscuro", "Light"/"Claro",
  "Satellite"/"Satélite".
- Not proposed: auto-switching by time of day or OS theme, a fourth style, a labels toggle.
- **Top scrim on Light and Satellite**, only where there is a status bar: `height: calc(env(safe-area-inset-top) * 1.75)`,
  `linear-gradient(rgba(7,9,13,.6) calc(env(safe-area-inset-top) * .7), transparent)`, `pointer-events: none`. It is zero
  on desktop and solid behind the icons on a phone, so light status-bar icons stay readable. To check on the Fold when it
  is free.
- **The chrome stays dark on Light:** `--surface` goes from 0.82 to 0.94 opacity under `data-map-theme='light'`, or the
  paper shows through and the pills, panel and card turn three different greys (measured on the unfolded shot, L*: panel
  9.7, pills 10.2, layers button 9.7, card 7.8, the panel's solid footer 4.4). This applies the decision, it adds no
  exception.
- **`--map-shadow`:** the one chrome token that follows the style: `0 8px 24px -8px rgba(0,0,0,.35)` on Light, today's on
  Dark and Satellite.

## 5. Keeping the route and the overlay legible on each style

### 5.1 Light palette (the cartographer's; slice 1)

| Element | Hex |
| --- | --- |
| land / background / label halo | `#f2efe9` |
| wood | `#d4e2c6` |
| grass | `#e6ecd9` |
| urban | `#e4e0d8` |
| water, waterLine | `#b5d3e7`, `#a6c6e0` (rivers stay fainter than the secondary roads) |
| border | `#9a94a6` |
| label, labelStrong, peak | `#4a5266`, `#1f2533`, `#6b6455` |
| vector roads, no casing | motorway `#a9a6a0`, primary `#b5b2ac`, secondary `#c4c1bb`, minor `#c9c6bf` |
| rating ramp (overlay, route, badges, legend) | `#3a6fe0 #0e98a8 #d9a000 #cf4a10 #a8125f` |
| sky, fog (3D) | `#cfe0f2` |
| hillshade | exaggeration 0.25, shadow `rgba(74,64,50,0.35)`, accent `rgba(74,64,50,0.2)`, highlight `rgba(255,255,255,0.5)`; pinned by a test (5.4) |

The roads are warm neutrals on purpose: an orange motorway reads as a rating-4 road, and a cool grey is what a protanope confuses with the teal rating (the first grey measured dE 9.9 against it; this one 15.4 or more in every vision). They stay clear of the paper (1.5 to 2.1:1 on land, the first set vanished from z13) and darker than the rivers. Roads carry no casing in v1.

### 5.2 Structure on Light (reusing existing layers, no new ones)

- **Overlay:** the glow layer becomes the casing: `line-color #1b2335`, `line-blur 0`, `line-width` 2.2 px at z5 to 5.6 px at
  z12, `line-opacity` interpolated 0 at z6 to 0.8 at z9 (off at the Spain view, so thousands of cased lines do not become a
  scribble). The line keeps the deep ramp. `setOverlayDimmed` reads the theme; stepped back behind a ride the casing is
  0.1 and the line 0.4 (at 0.2 and 0.2 the ramp turned to mud).
- **Route, transit:** a lighter slate `#4a5468` at 3.5 px with a white casing (the navy of the first version outshouted
  the twisty sections: on Light the curves must lead); **track:** the same slate, dashed (the dash alone says gravel);
  **twisty**, from the outside in: `route-twisty-glow` as a **navy edge** (`#1b2335`, 11 px, 0.95), `route-twisty-casing`
  as a **white rim** (`#ffffff`, 8 px, 1), the ramp at 6 px, and `route-twisty-halo` at 0. The order matters: with the navy
  directly against the ramp, the epic magenta merges into it for a protanope (1.44:1, dE 8.5) and no change of colour
  fixes it; with the white rim between them every rating stands out in every vision.
- **Legend pill** keeps its dark chrome with the swatches on a cream backing strip (2 px padding) so it previews the map.

### 5.3 Satellite (slice 2, frozen after the review round on the shots)

- **The photo lies over the fills**, which are dark (background `#1c211c`), with a 300 ms `raster-fade-duration`: each tile
  covers them as it fades in, so a slow or failed load shows a dark map with the route, not holes, and no load-tracking
  state is needed. The overdraw of the fills under the photo is one of the Huawei numbers.
- **Vector roads:** primary and secondary white at 0.35, 0.5-1.5 px from z7 to z13, fading out by z14 (below z13 the photo
  is too coarse to show a road); minor roads hidden.
- **Route: solid bands, no tube.** The tube (a translucent fill so the asphalt shows inside the line) was built and
  dropped on the cartographer's numbers: a carriageway is under 1 CSS px at z13, and neighbouring ratings composited at
  0.6 over snow, cereal and olive fall to dE 6.3-7.5. It may come back at z16 only once the route draws the twisty's own
  geometry (ROADMAP Next up 21). From the outside in: a white band (12 px, 0.9), a black rim (8 px, 0.9), the bright ramp
  (5 px). Transit white 4 px on a black 0.85 casing, 7 px. Casings are unblurred: a blurred rim is half as dark at its edge,
  and on snow that edge is all that separates the line. **Tracks** tan `#d2a86e`, dashed, on the black casing, as on Dark
  and in the sheet's tracks line.
- **Overlay:** the bright ramp, opaque, with the navy `#1b2335` casing from the glow layer at 0.8. At the Spain view the
  casing is thinner (1.6 px at z5) and starts at 0.56 (z5) rising to 0.8 by z8, the least that keeps amber at 3:1 on
  bleached cereal. Stepped back behind a ride it fades out between z13.5 and z14, so the route and the overlay do not
  draw one twisty twice where the route's simplified geometry drifts off the road (until ROADMAP Next up 21).
- **Labels:** white with a softer halo (`rgba(0,0,0,.65)`, blur 0.8); **peak names under the route layers**, so they do
  not cross the line on a busy photo. **Sky and fog:** a hazy dusk blue, not night (pitch-75 shot for the cartographer).
  **Hillshade:** off. 3D keeps the photo draped on the relief.
- **Failure:** MapLibre reports every failed tile but a 404 (IGN answers 200 with a blank tile outside coverage, 400 for a
  bad level). Three failures with no tile loading in between replace the credit line with a button "Satellite is
  unavailable · Use dark"; it never switches on its own, and a new visit to Satellite starts afresh.
- **Framing:** the route fit keeps clear of the foot of the map while it shows a credit or the note (fit margin plus its
  height plus a pin's radius), and its top margin is 132 px so the open style strip never covers a pin.

### 5.4 The contrast and colour test (the gate)

`theme.test.ts` fails the build when any of these fail, for every theme table:

1. Composite every `rgba` and opacity over the surface before measuring (blur counts as half opacity at its edge).
2. **Surfaces.** The fills of the theme (land, wood, grass, urban), and the bounds of how dark the hillshade can make the
   land: its shadow, and its shadow and accent together, laid on at full strength over land and wood (Light: `#b7b2a9`,
   `#a19b91`, `#a4a992`, `#92947f`). The bounds are darker than any render: measured on loaded renders of the light map
   at z8, z10.5 and z12 over the Pyrenees and Cazorla, the darkest land (p5 of the median-filtered land pixels) is
   L* 84.4 to 86.8 (`#ccd5be` is the darkest sample). The hillshade values are pinned in a test, so a stronger shadow
   cannot pass silently: change them and measure again. **Satellite** adds fixed photo samples: snow `#f2f3f0`, bleached
   cereal `#d8c6a0`, olive `#8f8a66`, forest `#2c3a26`, deep forest `#18211a`, reservoir `#2b4a5a`.
3. **Bands.** A line is modelled band by band from the outside in. Neighbouring bands are *apart* when they have 3:1
   contrast, or differ by dE 20 or more **for every kind of colour vision** (normal, deutan, protan, tritan): the rule the
   cartographer approved on that basis, replacing the plan's bare 3:1 (the deep blue sits at 3.0:1 from navy and passes by
   hue). The strongest band reaches 4.5:1 on the fills and 3:1 on the bounds for the twisty route; the transit and track
   lines (a slate in a white rim, read by their own two tones) reach 4.5:1 on the fills and 2.4:1 on the bounds (the slate
   holds 2.45 on the darkest bound). The overlay reaches 3:1 from z9, and its ramp is apart from its casing in normal
   vision only: **known exception**, epic merges with the navy casing for a protanope, and a third band on every overlay
   line is not worth its cost.
4. **Colour vision.** Neighbouring ratings at least dE 10 apart, and every base-road colour at least dE 15 from every
   rating, both in every vision (CIEDE2000 after Machado simulation); no exceptions.
5. Every theme defines every themed layer and property (a missed entry cannot ship), the dark table equals today's
   constants, and the light ramp is deeper than the sheet's (lower L* and a hue within 30 degrees of its twin).

The measured starting numbers for the Light ramp (cartographer): neighbouring ratings dE 27/45/31/33; closest pair dE 15.1
deutan, 18.2 protan, 11.1 tritan; on cream 4.0, 3.0, 2.0, 3.9, 6.2:1 (amber stays under 3:1, so the casing carries it from
z8). The test script is the same computation.

### 5.5 Shot list (run before the satellite numbers are frozen; the Light ones in slice 1)

Headless at 360×780 dpr 3, Fold cover and unfolded, every shot **with the route in frame** (A to B), at z11, z13 and z15:
Jaca → Benasque (forests: Ansó/Hecho, the Benasque valley), Alpujarra or Sierra de Cazorla (olive groves, bleached
fields), Navacerrada or Sierra Nevada (snow), a big city, the Valencian coast; one set with a tracks ride (the dashed
line); a Spain-wide view; Light and Dark at the same places; one side-by-side of the map ramp and the sheet's bar chart.
The reviewers judge shots, not code. The earlier spike shots 3 and 4 had no route in frame and are not evidence.

## 6. Load time, offline, failure

- **Start:** the dark default is unchanged. A hidden raster layer fetches nothing (MapLibre 6.14 requests no tiles for a
  source whose layers are all hidden, and riders who never pick satellite never contact IGN); the slice 2 network-log
  check proves it rather than assuming it.
- **Satellite (spike, headless, dpr 3, Jaca → Benasque, nothing cached):** 10 requests / 155 KB at the trip view, 8 / 105 KB
  at z13, 20 / 228 KB tilted in 3D. Volume: about 30-60 tiles per session, negligible against IGN's CloudFront cache.
  To measure on the Huawei when assigned (gates slice 2): time to a full view after switching, pan frame time at z14 vs
  Dark, JPEG decode in 3D, overdraw of the loading fade. If 3D satellite is too heavy there, cap `maxPitch` in satellite.
- **Light:** zero extra bytes (the same vector tiles, already in the HTTP cache).
- **Offline:** map tiles need a connection today and satellite is no exception; one-year cache headers make a revisited
  area free while they last. Offline packs never prefetch IGN tiles without CNIG's answer; OpenFreeMap allows app offline
  downloads of at most 3,000 tiles / 50 MB each.

## 7. What stays in the credits

The credits sheet and README keep Map data, Elevation and Place search as they are (the Road relief block still waits for
the road-value work) and gain the "Satellite view" block of 2.1 in slice 2. The map's attribution control keeps the
OSM/OpenFreeMap/OpenMapTiles and Terrain Tiles credits; the always-visible imagery line of 2.1 is separate and shown only
on Satellite. Light adds nothing. `style.test.ts` asserts both formulas of the imagery credit (slice 2).

## 8. Slices

1. **Theme module, the Light map and the switch** (now): `theme.ts` and its tests (5.4 for Dark and Light), `applyTheme`,
   the layers button and card (two tiles), stored choice, top scrim and `--map-shadow` on Light, cross-fade, badge and
   legend ramps, Light shots (5.5). No third-party host.
2. **Satellite** (director's go, after this plan lands and the Huawei measurement): the `ortho` source and layers, the
   satellite table and tube, the always-visible credit and its test, credits block and README, the failure note, the
   fills-after-load and dark-background behaviour, satellite shots, the Huawei numbers.
3. **Polish** with the reviewers' lists, then Fold checks when the phone is released.

Gates per slice: `npm run check`, related vitest, full suite in a heavy slot at hand-back.

## Decisions (director, 2026-10-17)

- Chrome stays dark on every style in v1; the scrim and the map shadow are the only exceptions.
- A separate layers button under the 3D chip.
- Satellite stays free; offline packs do not prefetch IGN tiles without CNIG's answer (the director files it).
- The CNIG email is not a gate for slice 2 if the strict visible credit ships; nobody sends it until the maintainer says.
- The Huawei load measurement gates slice 2, not slice 1.
- Slice 1 may be built now; slice 2 waits for the go.
