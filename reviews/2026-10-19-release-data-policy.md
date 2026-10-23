## Data-policy release review: main @ 5b9590d (2026-10-19)

**Verdict:** three blockers stand between this build and a public Play release:
- the ODbL share-alike for the shipped data;
- the OSM credit being folded away at start;
- the missing privacy policy, both in the app and on a public page.

The shipped app's network traffic matches what PRD 5.3 and the credits promise; I found no extra hosts. Two privacy claims in the PRD are not honoured by the code. Legal calls stay with the maintainer.

**Sources, all read 2026-10-19.** Copies are in `<scratchpad>/terms/`.
- Nominatim usage policy: operations.osmfoundation.org/policies/nominatim/
- OSMF Attribution Guideline (adopted 2021-06-25, page edited 2026-09-10)
- OSMF Produced Work Guideline (2014)
- ODbL 1.0 text: opendatacommons.org/licenses/odbl/1-0/
- OSMF privacy policy (edited 2026-01-25)
- openfreemap.org, its ToS (2026-10-14) and privacy policy (2026-10-08)
- Google Maps URLs docs (updated 2026-10-16)
- Play Data safety help (answer/10787469) and User Data policy (answer/10144311)
- Android Auto Backup doc
- GitHub Pages docs
- IGN terms: not re-read, from my 2026-10-17 review (closed).

### Scores
- **Attribution: 5.** The credits sheet is complete in EN and ES (`app/src/lib/i18n/en.ts:58-91`, `es.ts:55-86`), and the imagery credit can never be folded away (`ImageryCredit.svelte:28`). But the OSM/OpenFreeMap map credit is collapsed at start (`MapView.svelte:319,335-339`). There is no derived-data notice, and the store listing has no credits yet.
- **ODbL: 3.** Four derived databases ship inside the APK: `graph.bin` 47.9 MB, `candidates.bin` 2.4 MB, `overlay/` 31 MB, `places.json` 3.7 MB. None carries a notice and no copy is offered. The repo is PRIVATE with no LICENSE.
- **Nominatim: 7.**
  - Requests go only on an explicit tap (`PlaceField.svelte:97`), one queue spaced 1.1 s apart (`geocoding.ts:251-263`).
  - A refusal triggers a 60 s cool-down, and answers are memoised for the session.
  - The User-Agent is appended (`capacitor.config.ts:10`).
  - Gaps: up to 5 requests per search, and no switch without an app update (an accepted, closed decision).
- **Google Maps: 9.** `MAX_WAYPOINTS = 9` with `slice` (`googleMaps.ts:4,74`), plus documented `api=1`, `origin`, `destination`, `travelmode` and `waypoints`. Nothing is scraped. URLs stay far under the 2,048-character limit.
- **Privacy: 6.** No analytics, accounts or crash SDKs, and the native plugin jars contain no network code. Against that:
  - `allowBackup="true"` (`AndroidManifest.xml:5`)
  - the exact start goes into the Google Maps URL, the GPX and the shared text
  - there is no privacy policy anywhere

### Q1. Every network call the shipped app makes
- **`tiles.openfreemap.org` (Cloudflare):** the TileJSON, the vector tiles (maxzoom 14 per the TileJSON) and the label fonts (`style.ts:12-13`). Always.
- **`elevation-tiles-prod.s3.amazonaws.com` (AWS S3):** hillshade and 3D terrain, maxzoom 13 (`style.ts:14,45`). Always.
- **`www.ign.es/wmts/pnoa-ma` (CloudFront):** satellite only (`style.ts:16-17,73-76`).
- **`nominatim.openstreetmap.org`:** only on an explicit tap (`geocoding.ts:259`).
- **`www.google.com/maps/dir`:** only when the rider opens it. It is handed to the Google Maps app or the browser (`RideActions.svelte:167`).
- **Local only:** `graph.bin`, `candidates.bin`, `places.json`, `meta.json` and the overlay tiles (custom protocol, `overlayProtocol.ts:5`) are read from the APK. The fonts (`@fontsource`) are bundled.
- **Strings, not requests:** svelte.dev, maplibre.org, github.com and wiki.openstreetmap.org appear in `dist/assets/*.js` only inside error messages and the logo link.
- **Native plugins:** none phones home. `iongeolocation-android-2.2.2` contains no URLs. It uses Play services location, which is an on-device API under the device's own settings. Capacitor's CLI telemetry is dev-only.
- This list matches the PRD and the credits. One unverified item is under m6.

### Findings, ranked

**Blockers**

1. **B1. ODbL share-alike is not met for the shipped derived databases.**
   - **Evidence:** ODbL 1.0 §4.2(b)(d), §4.4(a) and §4.6. Shipping the files inside the APK "Conveys" copies, and Play internal or closed testers already count as "Publicly", since they are people not under your control. `app/public/data/` has no notice, `meta.json` has no licence field, and there is no public host (`gh repo view`: PRIVATE).
   - **Produced Work route: not available for the shipped files.** They are databases meant for extraction, and the Produced Work guideline adds that "if you publish a produced work, the underlying database has to be published as well … according to section 4.6". The rest needs only the §4.3 notice, which the map attribution gives once B2 is fixed:
     - Produced Works: the map on screen, the drawn route.
     - Insubstantial routing output: the GPX, the Google Maps URL, the share text.
   - **Minimal shape for launch:**
     - **(a) Notice in the APK.** The pipeline writes `app/public/data/LICENSE.txt` next to the files (§4.2d) and adds `"license":"ODbL-1.0","attribution":"© OpenStreetMap contributors"` to `meta.json`. Suggested text: "Twisty road data (graph.bin, candidates.bin, places.json, overlay/) is a Derivative Database of OpenStreetMap, © OpenStreetMap contributors, available under the Open Database License 1.0, https://opendatacommons.org/licenses/odbl/1-0/. Source: Geofabrik spain-latest.osm.pbf, data as of <date>; see https://www.openstreetmap.org/copyright. Twisty's additions (fun scores, curvature, twisty chains, place ranking) are released under the same licence. A free copy: <URL>."
     - **(b) Public download.** For every data version shipped, publish a free, no-login download of exactly those files: the four artefacts, `meta.json`, `LICENSE.txt`, the full ODbL text, and a short format note or a link to the parser source. The simplest host is a release in a new public repo (e.g. `sanchezpaco/twisty-data`, tagged by `meta.json` `generatedAt`). Keep each release up while an app version carrying it is distributed.
     - **(c) Credits sheet section, EN and ES, linking to (b).** EN: "Twisty's road data — Twisty's routing graph, twisty roads and place index are built from OpenStreetMap and are available under the Open Database Licence. Download them free of charge." ES: "Datos de carreteras de Twisty — El grafo de rutas, las carreteras con curvas y el índice de lugares de Twisty se han creado a partir de OpenStreetMap y están disponibles bajo la Open Database Licence. Descárgalos gratis."
     - **(d) README line.**
   - `tracks.bin` is not shipped, so it is out of scope. The DEM relief is not in `graph.bin` yet: add the Copernicus, USGS and NOAA lines when road-value lands.
   - **Owner:** routing (notice, `meta.json`, bundle script), app (credits copy), director (public repo and release). It must land before internal testing with anyone other than the maintainer.

2. **B2. The OSM credit is hidden at start.**
   - **Evidence:** `MapView.svelte:317-319` builds a compact control, and `:333-339` removes both open markers at load, so only the (i) button shows. The OSMF Attribution Guideline (safe harbour) says: "The attribution format should not require individuals to interact with the map … to see the attribution". It may collapse only on a dismiss, on map interaction, or "automatically after five seconds". OpenFreeMap: "Attribution is required." The start screen shows only a "Credits" button (`Panel.svelte:668`).
   - **Fix:** stop collapsing at load. MapLibre already folds the control on `drag` (`attribution_control.ts:80,212`); add a 5 s timer. Alternatively, put a visible line in the intro foot linking to openstreetmap.org/copyright: EN "Map data © OpenStreetMap", ES "Datos del mapa © OpenStreetMap". A start splash satisfies the guideline.
   - **Owner:** app.

3. **B3. There is no privacy policy, in the app or online.**
   - **Evidence:** the Play User Data policy requires "a valid privacy policy in both the app's store listing and within the app itself". No page exists and the app has no link.
   - **Hosting:** GitHub Pages "is available in public repositories with GitHub Free … and in public and private repositories with GitHub Pro". The repo is private, so either use a public repo for the site (it can be the same one as B1) or GitHub Pro.
   - **Fix:** publish the draft below in EN and ES, and add a "Privacy" link to the credits sheet and the intro foot (EN/ES). The policy URL also goes in the Play Console field.
   - **Owner:** director (page, host), app (links).

**Major**

4. **M1. Android Auto Backup copies the rider's on-device data off the phone.**
   - **Evidence:** `AndroidManifest.xml:5` sets `android:allowBackup="true"` and has no `dataExtractionRules`.
   - **What it means:** the Auto Backup doc says it uploads files under `getDir()`, which is where the WebView keeps localStorage, "to the user's Google Drive", end-to-end encrypted on Android 9+, and also does device-to-device transfers. That covers recent trips, saved rides, and `twisty.trip` (the exact "My location" for up to 2 h, `tripStorage.ts:82`). It contradicts "never leaves the phone".
   - **Data safety:** not affected. The data is in the user's own account and is end-to-end encrypted.
   - **Fix, maintainer's choice:**
     - (a) Keep backup, so saved rides survive a phone change, and say so in the policy. The draft assumes this.
     - (b) Set `allowBackup="false"` plus `dataExtractionRules` that exclude everything. The doc notes that `allowBackup="false"` alone does not stop device-to-device transfer on some API 31+ devices.
   - **Owner:** app (mobile-performance-engineer); the director decides.

5. **M2. The exact position leaves the phone, contrary to PRD 5.3.**
   - **Evidence:** PRD 5.3 says "The exact position and the trip history never leave the phone." But `ride.ts:332` passes `points[0]` to `googleMapsDirectionsUrl`, which writes it at 5 decimals (`googleMaps.ts:79`). The same URL is in the share text (`shareRide.ts:47`), and the GPX carries the whole line. So a "My location" start goes to Google Maps, to the GPX app and to the friend.
   - **Terms:** none is broken, since each handoff is rider-initiated.
   - **Fix:**
     - (a) Reword PRD 5.3 to: "…never leave the phone except as the start of a ride the rider hands to Google Maps, another app or a contact."
     - (b) Optional: when the start is "My location", omit `origin`. The Google docs say it "Defaults to most relevant starting location, such as device location", so shared links stop carrying a home coordinate.
   - **Owner:** director (PRD), routing (b).

6. **M3. At public scale, Nominatim's limit is per app, and one search sends up to 5 requests.**
   - **Evidence:**
     - The policy says "an absolute maximum of 1 request per second", and "the usage limits above apply per website/application: the sum of traffic by all your users should not exceed the limits". It also says "provided that your number of users is moderate".
     - `geocoding.ts:185-209` chains up to 3 word-drop attempts, a streets-only attempt and a with-town attempt. Each device spaces them 1.1 s apart, but nothing spaces them across devices.
   - **Volume flag (my estimate, from code reading):**
     - The ceiling is 3,600 requests per hour.
     - At about 2 requests per search, that is about 1,800 address searches in the busiest hour, i.e. about 15-20k a day if a weekend morning hour carries about 10%.
     - OSMF can see our User-Agent and may act earlier.
   - **Fix:** cap the chain at 2 requests for launch (the query, then one fallback), and add a contact URL to the User-Agent (m2).
   - **Out of scope:** the switch without an update is closed. One thing for the director to judge: today's page also says "Code generated by LLMs must adhere to all terms laid out in this policy". Raise it with the maintainer only if that clause was not in view when the decision was taken.
   - **Owner:** routing.

7. **M4. Data safety trap: "no data collected" would be false.**
   - **Evidence:** Play defines "Collect" as "transmitting data from your app off a user's device … irrespective of whether data is transmitted to you or a third-party server". The OSMF logs Nominatim requests and "analys[es] nominatim queries", so the requests are not ephemeral.
   - **Fix:** use the answers in the table below.
   - **Owner:** director.

**Minor**

8. **m1. The address-search row does not say it goes online or to whom.**
   - **Evidence:** `en.ts:32` reads "Search streets and addresses for “X”". Nominatim requires "Clearly display attribution", and Play's user-initiated exemption leans on what the rider expects.
   - **Fix:** EN "Search streets and addresses online for “X”" / ES "Buscar calles y direcciones en internet para «X»". Add a small "Nominatim · © OpenStreetMap" line under address results.
   - **Owner:** app.

9. **m2. The User-Agent has no version or contact.**
   - **Evidence:** `capacitor.config.ts:10`.
   - **Fix:** `Twisty/<version> (com.sanchezpaco.twisty; +<policy URL>)`.
   - **Owner:** app.

10. **m3. The store listing has no credits yet.**
    - **Fix:** in the full description, EN and ES: "Map data © OpenStreetMap contributors (ODbL) · Map tiles OpenFreeMap © OpenMapTiles · Elevation: Terrain Tiles (EU-DEM Copernicus, USGS SRTM/GMTED, NOAA ETOPO1) · Satellite: PNOA CC-BY 4.0 scne.es, MosaicoSentinel2 CC-BY 4.0 ign.es · Address search: Nominatim". Name Google Maps in plain text only: no Google logo, no implied endorsement.
    - **Owner:** director.

11. **m4. PRD 8's risk row contradicts the launch plan.**
    - **Evidence:** the row says to self-host or pay "before a public launch". OpenFreeMap states "there are no limits on the number of map views or requests".
    - **Fix:** rewrite the row as trigger volumes:
      - tiles: none stated;
      - Nominatim: M3;
      - IGN: a courtesy note at about 50k satellite sessions a day (2026-10-17 review);
      - offline packs: OpenFreeMap's 3,000 tiles / 50 MB / 4 parallel requests per download, and CNIG first.
    - **Owner:** director.

12. **m5. The GPX carries no OSM notice.**
    - **Evidence:** `gpx.ts:21-22`. It is not required (insubstantial routing output), but the file travels to third parties.
    - **Fix:** add `<copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/1-0/</license></copyright>` in `<metadata>`.
    - **Owner:** routing.

13. **m6. Unverified: Cloudflare error reporting.**
    - **Evidence:** OpenFreeMap responses send `nel` and `report-to` headers pointing to `a.nel.cloudflare.com` (`success_fraction 0.0`, so errors only). I could not verify whether the Android WebView honours NEL. If it does, failed tile requests produce reports to Cloudflare, a company the policy already names.
    - I also could not find a WebView metrics opt-out on today's reference page, so I make no claim about it.
    - **Owner:** app, to check if wanted.

### Q2. Attribution
- **Credits sheet, EN and ES (`en.ts:58-91`, `es.ts:55-86`):** OSM with the ODbL and the /copyright link, OpenFreeMap/OpenMapTiles, Terrain Tiles with EU-DEM/SRTM/GMTED/ETOPO1, PNOA and Sentinel with dates plus Airbus and MODIS, and Nominatim.
- **On the map:** the TileJSON brings "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", and the DEM credit is in `style.ts:46`. Both are hidden at start (B2).
- **Satellite:** the dated IGN credit stays visible (`ImageryCredit.svelte`, `style.ts:22-24`). The IGN condition is met.
- **Missing:** the derived-data notice (B1), the privacy link (B3) and the listing (m3).

### Q6. Blockers per service for a Spain launch
- **Nominatim:** none at launch. The per-app ceiling (M3) is the condition to watch.
- **OpenFreeMap:**
  - No request limits; MapLibre carries the attribution once B2 is fixed.
  - The ToS lets them "discontinue it at any time without notice". That is an availability risk, not a licence condition.
- **AWS Terrain Tiles:** no published limits; attributed.
- **IGN:** cleared by the visible dated credit and by satellite staying free (closed).

### Q7. Google Maps URLs and the "Open in…" GPX handoff
- **Google Maps URLs:** no terms issue. The format is documented and needs no key. Waypoints are "up to three … on mobile browsers, and a maximum of nine otherwise", so a friend who opens a shared link in a mobile browser loses pins. That is UX, not terms. The ToS ban on bulk download does not apply.
- **GPX handoff:** fine.
  - It goes through `FileProvider` from the cache (`shareFile.ts:26`), a read grant (`OpenInPlugin.java:64-67`) and a narrow `<queries>` with no `QUERY_ALL_PACKAGES` (`AndroidManifest.xml:44-49`).
  - Data safety: this is an on-device transfer the rider starts, so it is exempt from "sharing".
  - Play calls an installed-apps inventory personal and sensitive, so the policy names the GPX-app lookup.

---

### Privacy policy draft (EN; publish with an ES translation)

**Twisty — Privacy policy**
Last updated: [date]

Twisty is a free app that plans motorcycle routes in Spain. It is published by [developer name as shown on Google Play] ("we"). Contact: [contact email chosen by the maintainer].

**In short.** Twisty has no accounts, no ads, no analytics, no tracking and no crash reporting. We run no servers, and the app sends nothing to us. Route planning and town search happen on your phone. Data leaves your phone only to show the map and when you choose to search an address, open a navigation app or share a ride. Each case is described below.

**1. What Twisty keeps on your phone**
- **Recent trips:** your last 5 trips: start, finish, stops and the curve setting you chose. When a trip starts at "My location", Twisty does not store that position; it asks for it again when you reuse the trip.
- **Saved rides and folders:** the rides you save, including their line on the map, their start and their finish. If a saved ride started at "My location", its start is your position at that time.
- **The ride on screen:** kept for up to 2 hours so it can be restored if Android closes Twisty while you navigate. It is deleted the next time you open Twisty after that.
- **Settings:** language, map style and your preferred navigation app.
- **Temporary GPX files:** when you open a ride in another app, a GPX file of the ride is written to the app's cache so that app can read it.
- **Road data and town index:** these are part of the app and contain no personal data.

This data never goes to us. You can delete it at any time: "Clear all" in Recent trips, remove saved rides or folders, or clear Twisty's storage in Android settings. Uninstalling also removes it.

*Android backup:* if you have turned on backup on your device, Android may include Twisty's data in your own Google backup or in a transfer to a new phone. On Android 9 and later that backup is encrypted with your screen lock. We cannot read it. [Keep this paragraph only if backup stays enabled; see M1.]

**2. Your location**
- **When Twisty asks:** only when you tap "Start from my location" or reuse a trip that starts there. Android lets you allow approximate or precise location, and Twisty works with either.
- **What it is used for, on your phone:** setting the start of your trip, and, once you have allowed it, putting address results near you first.
- **What it is not used for:** Twisty does not use your location in the background and never sends it to us. Section 3 says exactly what part of it can leave the phone, and when.

**3. What leaves your phone, to whom, and when**
- **a) Map images, whenever the map is shown.**
  - OpenFreeMap provides the map tiles and label fonts and is delivered through Cloudflare.
  - Terrain Tiles on Amazon Web Services provide the relief shading.
  - Only if you choose the Satellite view, the Instituto Geográfico Nacional provides the imagery, delivered through Amazon CloudFront.
  - Like any website, these services receive your IP address, the app's name and the map tiles requested. The tiles show the area you are looking at, including the area around you when you centre the map on your position. Twisty sends them nothing else.
  - Their own privacy policies apply: openfreemap.org/privacy, aws.amazon.com/privacy, ign.es.
- **b) Address search, only when you tap "Search streets and addresses".**
  - The search is sent to Nominatim, run by the OpenStreetMap Foundation.
  - It sends the text you typed and your language.
  - Only if Twisty already has location permission, it also sends a search box of about 2 degrees (roughly 170 × 220 km) centred on your position rounded to 0.1 degree (about 10 km), and possibly the name of the nearest town or village.
  - Your exact position is never sent.
  - The OpenStreetMap Foundation logs requests, including IP address, app name and search text, and may analyse searches to improve OpenStreetMap: osmfoundation.org/wiki/Privacy_Policy.
  - Twisty keeps the results in memory until you close the app.
  - Towns and villages are searched on your phone and send nothing.
- **c) Google Maps, only when you open a ride in it.**
  - Twisty opens a Google Maps link containing the start, the finish, your stops and up to 9 points along the ride.
  - If the trip starts at "My location", the start is your position as found. [If M2(b) lands: "…the link leaves the start out and Google Maps uses your device's location."]
  - From then on, Google's terms and privacy policy apply.
- **d) Other navigation apps and sharing, only when you choose.**
  - "Open in…" gives the app you pick a GPX file of the whole ride, including its start.
  - "Share" gives the app or person you pick a short summary of the ride and its Google Maps link, which includes the start.
- **e) Links in Credits** open in your browser.

All of these connections use HTTPS.

**4. Apps on your phone**
To list the navigation apps that can open a GPX file, Twisty asks Android which installed apps open GPX files. Only those apps are checked. The list, and the app you choose to always use, stay on your phone.

**5. Children**
Twisty is meant for adult riders and is not directed at children.

**6. Your rights**
We hold no personal data about you, so there is nothing for us to give you, correct or delete. The data on your phone is under your control (section 1). For data received by the services in section 3, contact them directly through the policies linked above. In Spain you can also complain to the Agencia Española de Protección de Datos (aepd.es).

**7. Changes**
If Twisty's handling of data changes, we will update this page and its date before the app update that brings the change.

**8. Contact**
[contact email]

---

### Play Data safety answers

| Question / data type | Answer | Why (code) |
|---|---|---|
| Collects or shares required data types? | **Yes** | Nominatim gets the search text and an approximate area (`geocoding.ts:233-259`); the OSMF logs it, so it is not ephemeral |
| Location → Approximate | **Collected: yes. Shared: no** (rider-initiated; declare "shared" if m1 does not land). **Optional.** Purpose: **App functionality.** Ephemeral: **no** | A 0.1° grid with a ±1° box, plus a town within 4 km (`geocoding.ts:213-219,243-247`). Tile requests stop at z14/z13, which is also approximate |
| Location → Precise | **Not collected, not shared** | The exact fix never leaves through the app. The Google Maps, GPX and share handoffs are on-device transfers the rider starts (exemption) |
| App activity → In-app search history | **Collected: yes. Shared: no** (rider-initiated). **Optional.** Purpose: **App functionality.** Ephemeral: **no** | The address text goes to Nominatim |
| App activity → Installed apps | Not collected | Queried on the device only (`OpenInPlugin.java:88-92`) |
| Personal info, financial, health, messages, photos/videos, audio, files/docs, calendar, contacts, web history, app info & performance, device IDs | **Not collected** | No accounts, SDKs or crash reporting; the GPX is an on-device handoff |
| Encrypted in transit | **Yes** | Every host is HTTPS (`style.ts:12-17`, `geocoding.ts:259`) |
| Users can request deletion | **No** (nothing is held by the developer; the policy explains deletion on the device) | No backend |
| Account creation | None | — |
| Backup | Not collection | Play FAQ: an upload to the user's own cloud that the app never reads; end-to-end encrypted |

### What works, don't break it
- Address search fires only on a tap and never as you type. Keep the single queue, the 1.1 s spacing, the 60 s cool-down, the per-session memo, the 0.1° rounding and the appended User-Agent.
- Recent trips never store the "My location" coordinates (`tripHistory.ts:9-29`), and the restore slot deletes itself after 2 h.
- Satellite fetches nothing until it is chosen, and its dated credit can never be folded away.
- The `<queries>` entry is narrow and the app has no broad package access. The only permissions are INTERNET and COARSE/FINE location, asked on a tap only.
- The app has no analytics, no Firebase (google-services is not applied) and no remote config.
- The 9-waypoint cap and the documented URL format.

No repository files were touched.

