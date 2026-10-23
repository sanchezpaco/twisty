# Street search finds real addresses

ROADMAP Next up 14, with the Phase 8 Nominatim item (identifying header, memoise per query). Owner: routing.

## Cause (measured)

"avenida escultor <name>" returns nothing because OSM names the street "Avinguda de <name>"
(`name:es` "Avenida de <name>"): there is no "Escultor" in it. Nominatim matches a result only when every word
of the query is in its name or address, so one word the rider adds that OSM lacks empties the list. "avenida
<name>" finds it first. The bias, the viewbox and the bilingual name are not the cause: Nominatim indexes `name:es`
and `name:ca`, and the same query typed without "escultor" works with today's parameters.

The same rule breaks other rider habits:

- a title the OSM name lacks ("escultor", "pintor", "doctor");
- a street type that differs from OSM's ("calle <name> <town>" when OSM says "Avenida");
- a particle OSM lacks ("calle del franco" for "Rúa do Franco").

When the query names a street type, POIs that carry it in their address also crowd out the street (hotels for
"paseo de gracia", an office for "calle de la diputacion").

Measured on 22 rider-style queries in Spanish, Valencian, Catalan, Galician and Basque towns (a hit is the street in
the right town among the first 3; script in the session scratchpad, 32 requests at 1.3 s):

| Variant | Hits |
| --- | --- |
| Today (query as typed) | 9 / 22 |
| Fallbacks on an empty answer, address layer when the query names a street type | 14 / 22 |
| Both, plus a ±0.3 deg bias box and results re-ranked by distance | 14 / 22 (and the first case gets a museum first) |
| Street type dropped from the first try | 12 / 22 |

The fixed cases: avenida escultor <name>, calle <name> <town>, calle gran de gracia barcelona,
calle principe vigo, calle de la força girona.

## Change

1. `addressQueries(query)`, a pure function in `geocoding.ts`, returns the attempts in order, each one different
   from the one before:
   1. the query as typed;
   2. without title words and particles (`de`, `del`, `la`, `l'`, `d'`, `do`, `da`, …);
   3. also without the street type (`calle`, `avenida`, `avinguda`, `carrer`, `rúa`, `plaza`, `plaça`, `praza`,
      `paseo`, `passeig`, `camino`, `camí`, `kalea`, `etorbidea`, …).
   The word lists are named constants at the top of the module.
2. `searchAddresses` tries them in order and stops at the first one with results. It makes at most 3 requests, and
   only on the rider's explicit search.
   - When the query names a street type, every request adds `layer=address`, so streets and houses come back, not
     POIs. A query without a type still finds POIs ("gasolinera repsol jaca").
3. A gate keeps at least `NOMINATIM_GAP_MS = 1_100` between any two requests, whichever field sends them. The usage
   policy allows 1 per second at most. A miss costs the rider about 2 s more, behind the existing spinner.
4. As built: the detail under each result now names the town and the province. In Spain Nominatim tags the province
   `state_district`, and a Galician town only `municipality`, so "Rúa do Franco" showed "Galicia" and no town.
5. Results are memoised for the session by query, language and bias point (rounded to 0.1 deg). A failed request is
   not memoised.
6. Identifying header. A browser `fetch` cannot set `User-Agent`, and the Android WebView's Referer is
   `https://localhost/`, which identifies nothing. As built: `appendUserAgent: 'Twisty (app.twisty.planner)'`
   in `capacitor.config.ts`, without a version that would go stale next to `versionName`. The web build keeps the site's Referer, which the policy accepts. Then check the header
   once on a phone (WebView `navigator.userAgent`, through `chrome://inspect`). `capacitor.config.ts` belongs to the
   app session; the director let this branch carry the line, and the phone check joins the director's next phone pass.

## Tests

- `addressQueries`:
  - Spanish, Valencian/Catalan, Galician and Basque names.
  - Titles, particles with an apostrophe (`l'Escultor`), types, a query with nothing to drop (one attempt).
  - Words such as "San", "Mayor" and "Gran" are kept.
- `searchAddresses`, with a stubbed `fetch` and fake timers:
  - the fallback order, stopping at the first answer;
  - `layer=address` only when a street type is named;
  - the gap between requests;
  - the memo hit, and a failure that is not memoised.
- No test calls Nominatim. The 22-query measurement is re-run once before hand-back and its numbers go in the
  hand-back.

## Known limits (not in this change)

- "<street> valencia" matches the province too, and its towns' namesakes fill the list before València city's
  street (calle colon, pintor sorolla, marques de sotelo, blasco ibañez). A tighter box with re-ranking did not fix
  it (table above). The fix would be to read a trailing town against the offline place index and send a structured
  `city=` query. Filed as ROADMAP Next up 22, with the two below.
- A Spanish type on a Catalan-only name ("paseo de gracia" for "Passeig de Gràcia" without `name:es`) and spelling
  across languages ("diputacion" / "Diputació") still miss. Fixing them would need type translation by region.
- A non-empty but wrong first answer stops the fallbacks ("calle del franco santiago" finds a León street).
