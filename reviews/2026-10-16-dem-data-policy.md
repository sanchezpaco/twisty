## Data-policy review: Terrarium DEM in the pipeline (relief factor, plan step 2)

**Verdict:** you can use the DEM in the pipeline. Nothing in the terms forbids downloading the tiles once or baking a relief value into `graph.bin`. Two things must land first. The app's DEM credit has to name Copernicus EU-DEM and the USGS, and say the data was modified. That gap already exists today because of the hillshade. And mixing DEM values into the OSM-derived graph widens what the open ODbL share-alike item will have to publish. Legal calls stay with the maintainer.

Sources, all read on 2026-10-16:
- AWS registry entry: https://registry.opendata.aws/terrain-tiles/ and `open-data-registry/datasets/terrain-tiles.yaml`. Its `License:` field points to the Joerd attribution page.
- Joerd attribution page: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
- Joerd data sources: https://github.com/tilezen/joerd/blob/master/docs/data-sources.md
- Copernicus Land data policy: https://land.copernicus.eu/en/data-policy. It is governed by Reg. (EU) 2021/696. EUR-Lex returned an empty page, so I did not read the text of Delegated Reg. 1159/2013 itself.
- OSMF Collective Database Guideline, endorsed 2016-06-17: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Collective_Database_Guideline_Guideline

**Spain at z10 is EU-DEM data, measured.** I sent one HEAD request for `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/10/500/380.png` (central Spain). It returned `x-amz-meta-x-imagery-sources: eudem/eudem_dem_5deg_n40w005.tif` and `Content-Length: 123558`. So the Copernicus terms apply directly, not only in theory. Joerd's table also lists SRTM, GMTED and ETOPO1 at other zooms and as fill.

### 1. Scores

- **Attribution: 5.** `app/src/lib/map/style.ts:39` credits only `<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>`. The Joerd page marks the per-source credits "Required" (Copernicus EU-DEM, USGS SRTM/GMTED, NOAA ETOPO1), and the app shows none of them. OSM, OpenFreeMap and OpenMapTiles come through correctly from the OpenFreeMap TileJSON. `README.md:206-209` has the same DEM gap. There is no store listing yet.
- **ODbL: 4.** `graph.bin`, `twisties.json` and the overlay tiles ship inside the APK, which makes them a Derivative Database in public use. Nothing offers them under ODbL yet: `ROADMAP.md:388` is unticked, the repo is PRIVATE and has no LICENSE file. The relief factor makes this scope larger.
- **Nominatim: 6.** Light check only. Requests go one at a time on explicit request (`app/src/lib/geocoding.ts:95-113`). There is no cache in `searchAddresses`, and no identification beyond the WebView's default headers. I did not verify which Referer or User-Agent the Capacitor WebView sends.
- **Google Maps: 8.** Light check only. `MAX_WAYPOINTS = 9` (`app/src/lib/googleMaps.ts:4`), applied with `slice` at line 42, on the documented `https://www.google.com/maps/dir/?` URL.
- **Privacy: 8.** Light check only. The only permissions are INTERNET and COARSE/FINE location (`AndroidManifest.xml:50-53`). Outbound calls go to tiles, Nominatim and Google Maps; the rest are local data fetches. Nominatim receives a viewbox around the rider's position when one is known (`geocoding.ts:107-110`), which falls under the documented exception.

### 2. Findings, most severe first

1. **Major: the DEM credit omits sources the terms require. This already applies today because of the hillshade.**
   - **Evidence:** `style.ts:39` shows only "Terrain Tiles". The Joerd page says "Required attribution: … Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; … global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey", plus ETOPO1/NOAA. The EU-DEM header above proves the Spain tiles are EU-DEM.
   - **Copernicus policy:** users "shall inform the public of the source"; "Where the … products … have been adapted or modified by the user, the user shall clearly state this"; and they must not imply EU endorsement. A per-road relief value is a modification. For a derived product the policy asks for "Generated using European Union's Copernicus Land Monitoring Service information".
   - **Fix, owned by frontend-engineer (`style.ts` and an i18n credits string):** change the DEM source attribution to:
     `<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>: EU-DEM (Copernicus), SRTM/GMTED (USGS), ETOPO1 (NOAA)`
   - **Also needed: one full credits text, in the README Credits section and in an in-app credits or about view.** No such view exists yet. Add it with ES/EN copy in `app/src/lib/i18n/`. The full text should be:
     "Elevation: Terrain Tiles (Mapzen / AWS Open Data, accessed 2026-10-16). Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers. SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey. ETOPO1: NOAA National Centers for Environmental Information. Road relief values in Twisty's route data were generated using European Union's Copernicus Land Monitoring Service information and modified (climb per km per road); not endorsed by the EU."
   - **Store listing:** the same text goes in the listing once one exists. The director owns that at M5.
   - **Why the in-app view matters:** MapLibre shows a source's attribution only while a layer using it is visible. The hillshade covers that today. The relief inside `graph.bin` is not tied to any map layer, so it needs the static credits view, not only the map control.

2. **Major: the relief factor turns the DEM values into part of the ODbL Derivative Database, so share-alike reaches them.**
   - **Evidence:** `edgeFunM = length x curve value x pace_factor x relief factor x settlement factor` (plan section 5) is computed per OSM way and per chain. Under the OSMF guideline a Collective Database exists only when "a particular data type within a database consists entirely of non-OSM data". A fun value that mixes OSM curvature with DEM climb is not that. It is a Derivative Database, and share-alike covers the non-OSM part when the database is used publicly.
   - **Compatibility:** the Copernicus policy is free and open, says "the user has all intellectual property rights to the products he/she has created", and has no non-commercial or no-relicensing clause. USGS and NOAA data are public domain. So I see no conflict with releasing the derived values under ODbL. I did not read the text of 1159/2013 itself, so that remains unverified.
   - **Volume:** none. This triggers at public release (M5), not at tester builds. The repo is private now.
   - **Fix, owned by gis-data-engineer, with the director deciding:**
     - When the ODbL item (`ROADMAP.md:388`) lands, publish `graph.bin`, `twisties.json` and the overlay tiles, or the pipeline code plus inputs as the ODbL 4.6 "means of creating" route. Publish them under ODbL with an attribution notice that carries the Copernicus/USGS/NOAA lines above.
     - If the maintainer prefers a Collective Database, keep `relief_m_per_km` as its own field and apply the factor in the app. I advise against this. It breaks the plan's rule that the overlay and the planner compute fun with the same function. And the relief value is still sampled along OSM geometry, so it is arguably still OSM-derived and the gain is doubtful.
     - Add a line under the ODbL item in `ROADMAP.md` so the DEM is in its scope.

3. **Minor: bulk-download etiquette for the one-off ~900 tiles.**
   - **Evidence:** the AWS registry entry and Joerd docs publish no rate limit or bulk-download clause; I found none. The bucket is open with no requester-pays setting (the HEAD returned 200 unsigned).
   - **Size:** about 120 KB a tile, so roughly 110-145 MB at z10. My bounding-box count is about 1,200 tiles for mainland plus Balearics and about 98 for the Canaries. "About 900" fits if sea-only tiles are skipped.
   - **Volume:** a one-off ~1,000 GETs is trivial for S3. It would only become a problem if `make data` fetched them again on every run, or if someone moved to z12+ (16x the tiles).
   - **Fix, owned by gis-data-engineer:**
     - Download once into `data/raw/dem/` (already ignored by `/data/` in `.gitignore`) and skip files that already exist.
     - Keep concurrency at 4 or less, use an identifying User-Agent, and stop on 403 or 503.
     - Write a small `SOURCES.txt` next to the cache with the access date and each tile's `x-amz-meta-x-imagery-sources`, which feeds the credits.
     - Do not run it inside `make data` unless the cache is empty.
     - The registry also lists an eu-central-1 replica (`elevation-tiles-prod-eu`). My HEAD on the path-style URL returned 403, so I could not verify how to reach it. Use the us-east-1 bucket the app already uses.

4. **Minor: the plan should record where the relief signal comes from.**
   - **Evidence:** plan line 158 names the input but not its licence. The Copernicus rule "clearly state" the modification applies to the pipeline output.
   - **Fix, owned by gis-data-engineer:** add a `sources` entry, for example `"elevation": "Terrain Tiles z10 (EU-DEM/Copernicus, SRTM)"` with the date, to the pipeline's `meta.json` or the dataset README. Then the published ODbL bundle carries it without extra work.

5. **Minor, outside this question but seen on the way: Nominatim identification and caching are not verified.**
   - **Evidence:** `geocoding.ts:112` sends a plain `fetch` with no cache. The policy requires a valid Referer or User-Agent identifying the app. I did not re-read the Nominatim policy page this round, and I did not check what the Capacitor WebView sends as Referer.
   - **Fix, owned by routing-engineer:** check the headers the WebView sends, and memoise results per query string for the session.

### 3. What works, don't break it

- OSM, OpenFreeMap and OpenMapTiles attribution arrives from the TileJSON ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap"). Any change to the attribution control must keep it.
- The compact attribution control opens again from its button (`MapView.svelte:219-223`). Adding the DEM text must not make it overflow the phone sheet (`app.css:97`).
- One DEM source feeds both the hillshade and the terrain (`style.ts:54`), and the pipeline will use the same z10 tiles as the app, so one credit covers both.
- The new pipeline input changes no runtime traffic: `graph.bin` keeps its shape and the device makes no new network calls.
- Address search runs only on the rider's explicit request, and Google Maps URLs stay capped at 9 waypoints.

Paths: `app/src/lib/map/style.ts`, `README.md`, `ROADMAP.md`, `plans/2026-10-16-road-value.md`. I saved scratch copies of the terms pages in `<scratchpad>/dl/`. No repository files were touched.
