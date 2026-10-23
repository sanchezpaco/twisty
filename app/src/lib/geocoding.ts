import { haversineM, type LonLat } from './geo'

export interface Place {
  label: string
  /** Free text such as "Carrer de Colón, València" (address search). */
  detail?: string
  /** Towns and villages from the offline index, described in the rider's language. */
  kind?: PlaceKind
  context?: string
  position: LonLat
  /** Distance from the point the search was biased towards, when there was one. */
  distanceM?: number
  /** The rider's own position: it is never kept in the trip history. */
  here?: true
}

export type PlaceKind = 'city' | 'town' | 'village' | 'suburb' | 'hamlet'
type PlaceRow = [name: string, kind: PlaceKind, lon: number, lat: number, context: string | null]

const KIND_RANK: Record<PlaceKind, number> = { city: 0, town: 1, village: 2, suburb: 3, hamlet: 4 }
// Bigger places are worth a longer trip: a city 40 km away ranks like a hamlet 10 km away.
const KIND_REACH: Record<PlaceKind, number> = { city: 4, town: 2, village: 1.3, suburb: 1, hamlet: 1 }
const MAX_RESULTS = 8
// Address searches prefer, but are not limited to, this many degrees around the bias point.
const ADDRESS_BIAS_DEGREES = 1
// A map pick within this distance of a place is described by it.
const DESCRIBE_RADIUS_M = 4_000
// Further out a point (a pass, a viewpoint, a bend of a road) is named after the nearest place this close, as "near" it.
const DESCRIBE_NEAR_RADIUS_M = 25_000
// Nominatim's usage policy allows one request per second at most, and counts every phone running the app as one app: a
// search sends the query and one fallback at most (data-policy review 2026-10-19, M3).
const NOMINATIM_GAP_MS = 1_100
// After Nominatim refuses this phone (too many requests, or blocked), address search sends nothing for this long: a
// second tap would otherwise resend the whole chain of attempts into the refusal.
const NOMINATIM_COOL_DOWN_MS = 60_000
const REFUSED_STATUSES = [403, 429]
// Address searches biased within this many degrees of each other share one answer for the session; the bias point sent
// to Nominatim is rounded to the same grid, so a rider's exact position never leaves the phone.
const BIAS_GRID_DEGREES = 0.1
// Nominatim drops a result when any query word is missing from it, and riders add words OSM names often leave out:
// a title ("escultor"), a particle ("del" for "do") or another street type ("calle" for "avenida").
const TITLE_WORDS = new Set(
  ('escultor escultora pintor pintora poeta poetisa doctor doctora dr dra maestro maestra mestre mestra compositor ' +
    'escritor escritora escriptor escriptora arquitecto arquitecta arquitecte ingeniero enginyer profesor profesora ' +
    'professor professora catedratico cronista alcalde general capitan coronel padre pare fray').split(' '),
)
const PARTICLES = new Set('de del la las los el els les dels do da dos das i y'.split(' '))
const STREET_TYPES = new Set(
  ('calle c avenida av avda avinguda avgda carrer rua plaza pza pl placa praza paseo passeig pg camino cami ' +
    'carretera ctra ronda travesia travessera glorieta pasaje passatge callejon kalea kale etorbidea').split(' '),
)
// Catalan and Valencian elide the article or "de" onto the next word: "l'Escultor", "d'Alacant".
const ELISION = /^[ld]['’]/i

/** Instant, offline search over the towns and villages exported by the pipeline. */
export class PlaceIndex {
  private readonly keys: string[]
  private readonly words: string[][]

  constructor(private readonly rows: PlaceRow[]) {
    this.keys = rows.map(([name]) => normalize(name))
    this.words = this.keys.map((key) => key.split(/[\s\-'/]+/))
  }

  /** Best name matches first; among equally good matches, the closest to `near` (weighted by importance). */
  search(query: string, near: LonLat | null = null, limit = MAX_RESULTS): Place[] {
    const needle = normalize(query.trim())
    if (!needle) return []
    const matches: { index: number; quality: number; cost: number }[] = []
    this.keys.forEach((key, index) => {
      const quality =
        key === needle ? 0 : key.startsWith(needle) ? 1 : this.words[index].some((w) => w.startsWith(needle)) ? 2 : -1
      if (quality < 0) return
      const [, kind, lon, lat] = this.rows[index]
      const cost = near ? haversineM(near, [lon, lat]) / KIND_REACH[kind] : KIND_RANK[kind]
      matches.push({ index, quality, cost })
    })
    return matches
      .sort((a, b) => a.quality - b.quality || a.cost - b.cost || this.keys[a.index].length - this.keys[b.index].length)
      .slice(0, limit)
      .map(({ index }) => withDistance(this.place(index), near))
  }

  /**
   * A map point as a place: the nearest place within `DESCRIBE_RADIUS_M`, else "near" the nearest within
   * `DESCRIBE_NEAR_RADIUS_M` when the caller says how to word it, else its coordinates.
   */
  describe(position: LonLat, nearName?: (place: string) => string): Place {
    let nearest = -1
    let nearestM = nearName ? DESCRIBE_NEAR_RADIUS_M : DESCRIBE_RADIUS_M
    this.rows.forEach(([, , lon, lat], index) => {
      const distance = haversineM(position, [lon, lat])
      if (distance < nearestM) {
        nearest = index
        nearestM = distance
      }
    })
    if (nearest < 0) return { label: formatCoordinates(position), position }
    if (nearestM >= DESCRIBE_RADIUS_M && nearName) return { label: nearName(this.rows[nearest][0]), position }
    return { ...this.place(nearest), position }
  }

  private place(index: number): Place {
    const [name, kind, lon, lat, context] = this.rows[index]
    return { label: name, kind, context: context ?? undefined, position: [lon, lat] }
  }
}

let placeIndex: Promise<PlaceIndex> | null = null

export function loadPlaceIndex(): Promise<PlaceIndex> {
  placeIndex ??= fetch(`${import.meta.env.BASE_URL}data/places.json`)
    .then((response) => response.json())
    .then(({ places }: { places: PlaceRow[] }) => new PlaceIndex(places))
  return placeIndex
}

interface NominatimResult {
  lat: string
  lon: string
  name: string
  category: string
  address: Record<string, string | undefined>
}

// The parts of an address that name the place a result is in, not the result itself.
const LOCALITY_KEYS = ['city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'city_district', 'county', 'province', 'state_district', 'state']

const addressMemo = new Map<string, Promise<Place[]>>()
let nextRequestAt = 0
let refusedUntil = 0

/**
 * Streets, addresses and points of interest via OpenStreetMap's Nominatim. Its usage policy forbids
 * search-as-you-type, so this only runs when the rider explicitly asks for it.
 */
export async function searchAddresses(
  query: string,
  near: LonLat | null,
  language: string,
  rider: Promise<LonLat | null> = Promise.resolve(null),
): Promise<Place[]> {
  const bias = near?.map((c) => Math.round(c / BIAS_GRID_DEGREES)).join()
  const key = [normalize(query.trim()), language, bias].join('|')
  let riderAt: LonLat | null = null
  void rider.then((position) => (riderAt = position))
  let places = addressMemo.get(key)
  if (!places) {
    places = findAddresses(query, near, language, rider)
    addressMemo.set(key, places)
    places.catch(() => addressMemo.delete(key))
  }
  const found = await places
  return found.map((place) => withDistance(place, riderAt ?? near))
}

/**
 * Where an address search is biased: towards the rider when the position is known, else towards the place the field
 * holds (a rider changing the start from a town to a street of it). Never towards the other end of the trip: it can be
 * 100 km from a rider searching a street of their own town.
 */
export function addressBias(value: Place | null, rider: LonLat | null): LonLat | null {
  return rider ?? value?.position ?? null
}

/**
 * The query as typed, then without the words OSM names often lack; each attempt drops more, and none is left with no name
 * word: a bare "avenida" finds every avenue in the box.
 */
export function addressQueries(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean)
  const without = (...sets: Set<string>[]) =>
    words.filter((word) => !sets.some((set) => set.has(wordKey(word)))).map((word) => word.replace(ELISION, ''))
  const attempts = [words, without(TITLE_WORDS, PARTICLES), without(TITLE_WORDS, PARTICLES, STREET_TYPES)]
  return [...new Set(attempts.filter(hasNameWord).map((attempt) => attempt.join(' ')))]
}

const hasNameWord = (words: string[]) => words.some((word) => ![TITLE_WORDS, PARTICLES, STREET_TYPES].some((set) => set.has(wordKey(word))))

/**
 * The query as typed, then once more among streets only, with the fewest words of `addressQueries` and the town of the
 * bias point; the first answer that holds a result naming the query is kept, those results first. Nominatim also matches
 * a word in a result's street, its town or an alternative name, so a dentist on a namesake street, or a street that
 * merely sounds alike, comes back first; when the second request finds no better, the first answer is still given.
 */
async function findAddresses(query: string, fieldNear: LonLat | null, language: string, rider: Promise<LonLat | null>): Promise<Place[]> {
  // A rider who names a street type wants the street, not the shops and hotels that carry it in their address.
  const streetsOnly = query.split(/\s+/).some((word) => STREET_TYPES.has(wordKey(word)))
  const attempts = addressQueries(query)
  const last = attempts.at(-1)
  if (!last) return []
  let firstAnswer: NominatimResult[] = []
  const naming = async (attempt: string, streets: boolean, near: LonLat | null) => {
    const results = await requestNominatim(addressParams(attempt, near, language, streets))
    if (firstAnswer.length === 0) firstAnswer = results
    const named = results.filter((result) => names(result, attempt))
    return named.length ? toPlaces([...named, ...results.filter((result) => !named.includes(result))], query) : null
  }
  // The first request does not wait for the rider's fix; the second is biased towards the rider once it is known.
  const first = await naming(attempts[0], streetsOnly, fieldNear)
  if (first) return first
  const near = (await rider) ?? fieldNear
  const fallback = (await withTown(last, near)) ?? last
  return (await naming(fallback, true, near)) ?? toPlaces(firstAnswer, query)
}

/** The attempt with the name of the town at the bias point, when there is one and the attempt does not name it. */
async function withTown(attempt: string, near: LonLat | null): Promise<string | null> {
  if (!near) return null
  const town = await loadPlaceIndex()
    .then((index) => index.describe(near))
    .catch(() => null)
  return town?.kind && !normalize(attempt).includes(normalize(town.label)) ? `${attempt} ${town.label}` : null
}

/**
 * Whether a result is what the attempt names: every word of it (particles aside) in the result's name, its street or its
 * town, and the words not in its town all in the name or all in the street, not some in each.
 */
function names(result: NominatimResult, attempt: string): boolean {
  const tokens = (text: string | undefined) => new Set((text ?? '').split(/[\s\-'’/]+/).map(wordKey).filter(Boolean))
  const [name, street] = [tokens(result.name), tokens(result.address.road)]
  const locality = new Set(LOCALITY_KEYS.flatMap((key) => [...tokens(result.address[key])]))
  const words = attempt.split(/\s+/).map(wordKey).filter((word) => word && !PARTICLES.has(word) && !locality.has(word))
  return words.every((word) => name.has(word)) || words.every((word) => street.has(word))
}

function addressParams(query: string, near: LonLat | null, language: string, streetsOnly: boolean): URLSearchParams {
  const params = new URLSearchParams({
    q: query,
    'accept-language': language,
    format: 'jsonv2',
    countrycodes: 'es',
    limit: String(MAX_RESULTS),
    addressdetails: '1',
  })
  if (streetsOnly) params.set('layer', 'address')
  if (near) {
    const [lon, lat] = near.map((c) => Math.round(c / BIAS_GRID_DEGREES) * BIAS_GRID_DEGREES)
    const d = ADDRESS_BIAS_DEGREES
    params.set('viewbox', [lon - d, lat + d, lon + d, lat - d].map((c) => c.toFixed(1)).join(','))
  }
  return params
}

async function requestNominatim(params: URLSearchParams): Promise<NominatimResult[]> {
  throwIfCoolingDown()
  // The slot is taken before waiting, so searches from both fields queue up instead of firing together.
  const at = Math.max(Date.now(), nextRequestAt)
  nextRequestAt = at + NOMINATIM_GAP_MS
  if (at > Date.now()) await new Promise((resolve) => setTimeout(resolve, at - Date.now()))
  // A request queued behind the one that was refused must not follow it.
  throwIfCoolingDown()
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
  if (REFUSED_STATUSES.includes(response.status)) refusedUntil = Date.now() + NOMINATIM_COOL_DOWN_MS
  if (!response.ok) throw new Error(`Address search failed (${response.status})`)
  return (await response.json()) as NominatimResult[]
}

function throwIfCoolingDown() {
  if (Date.now() < refusedUntil) throw new Error('Address search failed (cooling down)')
}

function toPlaces(results: NominatimResult[], query: string): Place[] {
  const places = results.map(({ lat, lon, name, address }): Place => {
    const street = [address.road, address.house_number].filter(Boolean).join(' ')
    // In Spain Nominatim names the province `state_district`, and a Galician town only as `municipality`.
    const locality = address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality
    const province = address.province ?? address.state_district ?? address.state
    const detail = [name && street !== name ? street : undefined, locality, province]
    return {
      label: name || street || locality || query,
      detail: detail.filter(Boolean).join(', ') || undefined,
      position: [Number(lon), Number(lat)],
    }
  })
  // A street split into several OSM ways comes back once per piece.
  const seen = new Set<string>()
  return places.filter((place) => {
    const key = `${place.label}|${place.detail}`
    return !seen.has(key) && seen.add(key)
  })
}

function withDistance(place: Place, near: LonLat | null): Place {
  return near ? { ...place, distanceM: haversineM(near, place.position) } : place
}

export function formatCoordinates([lon, lat]: LonLat): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

function wordKey(word: string): string {
  return normalize(word).replace(ELISION, '').replace(/[.,/]/g, '')
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
