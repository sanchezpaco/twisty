import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addressBias, addressQueries, type Place, PlaceIndex } from './geocoding'

const index = new PlaceIndex([
  ['València', 'city', -0.3763, 39.4699, null],
  ['Los Santos', 'hamlet', -1.28, 40.1078, 'Ademuz'],
  ['Los Santos', 'village', -5.7973, 40.545, 'Guijuelo'],
  ['Santos de la Humosa', 'town', -3.2667, 40.5, null],
  ['Ademuz', 'town', -1.2865, 40.0617, null],
])

describe('PlaceIndex', () => {
  it('matches without accents or case and ranks exact, prefix, then word matches', () => {
    expect(index.search('valencia').map((p) => p.label)).toEqual(['València'])
    expect(index.search('santos').map((p) => p.label)).toEqual(['Santos de la Humosa', 'Los Santos', 'Los Santos'])
  })

  it('puts equally good matches closest to the bias point first and reports the distance', () => {
    const nearAdemuz = index.search('los santos', [-1.3, 40.06])
    expect(nearAdemuz.map((p) => [p.kind, p.context])).toEqual([
      ['hamlet', 'Ademuz'],
      ['village', 'Guijuelo'],
    ])
    expect(nearAdemuz[0].distanceM).toBeLessThan(10_000)
    expect(index.search('los santos', [-5.66, 40.97])[0].context).toBe('Guijuelo')
  })

  it('names a map pick after the nearest place, keeping the exact position', () => {
    expect(index.describe([-0.378, 39.471])).toEqual({
      label: 'València',
      kind: 'city',
      position: [-0.378, 39.471],
    })
    expect(index.describe([-5, 38]).label).toBe('38.0000, -5.0000')
  })

  it('names a point away from any place after the nearest one, when told how', () => {
    // About 9 km north of València: past the radius of a place, within the radius of "near".
    const point: [number, number] = [-0.3763, 39.551]
    expect(index.describe(point).label).toBe('39.5510, -0.3763')
    expect(index.describe(point, (place) => `Near ${place}`)).toEqual({ label: 'Near València', position: point })
  })
})

describe('addressBias', () => {
  const VALENCIA: Place = { label: 'València', kind: 'city', position: [-0.3763, 39.4699] }

  it('is the rider when known, else the place the field holds, else nothing: never the other end of the trip', () => {
    expect(addressBias(VALENCIA, [-0.38, 39.47])).toEqual([-0.38, 39.47])
    expect(addressBias(VALENCIA, null)).toEqual([-0.3763, 39.4699])
    expect(addressBias({ label: 'My location', position: [-0.37, 39.48], here: true }, null)).toEqual([-0.37, 39.48])
    expect(addressBias(null, null)).toBeNull()
  })
})

describe('addressQueries', () => {
  it('never leaves an attempt with no name word, only a street type, a title or particles', () => {
    expect(addressQueries('Avenida escultor josep')).toEqual(['Avenida escultor josep', 'Avenida josep', 'josep'])
    expect(addressQueries('avenida del escultor')).toEqual([])
  })

  it('drops the title OSM lacks, then the street type', () => {
    expect(addressQueries('avenida escultor josep ferrer')).toEqual([
      'avenida escultor josep ferrer',
      'avenida josep ferrer',
      'josep ferrer',
    ])
    expect(addressQueries('calle josep ferrer valencia')).toEqual(['calle josep ferrer valencia', 'josep ferrer valencia'])
  })

  it('drops particles, elided ones included, in Spanish, Valencian, Catalan and Galician', () => {
    expect(addressQueries("Carrer de l'Escultor Garcia Mas")).toEqual([
      "Carrer de l'Escultor Garcia Mas",
      'Carrer Garcia Mas',
      'Garcia Mas',
    ])
    expect(addressQueries("Avinguda d'Alacant, València")).toEqual([
      "Avinguda d'Alacant, València",
      'Avinguda Alacant, València',
      'Alacant, València',
    ])
    expect(addressQueries('calle del franco santiago')).toEqual([
      'calle del franco santiago',
      'calle franco santiago',
      'franco santiago',
    ])
    expect(addressQueries('Rúa do Vilar')).toEqual(['Rúa do Vilar', 'Rúa Vilar', 'Vilar'])
  })

  it('knows abbreviated and Basque street types wherever they stand', () => {
    expect(addressQueries('c/ mayor jaca').at(-1)).toBe('mayor jaca')
    expect(addressQueries('Avda. Dr. Peset Aleixandre').at(-1)).toBe('Peset Aleixandre')
    expect(addressQueries('Nagusia kalea Bilbo').at(-1)).toBe('Nagusia Bilbo')
  })

  it('keeps the words that are part of the name', () => {
    expect(addressQueries('calle san francisco bilbao').at(-1)).toBe('san francisco bilbao')
    expect(addressQueries('carrer gran de gracia').at(-1)).toBe('gran gracia')
  })

  it('makes one attempt when there is nothing to drop', () => {
    expect(addressQueries('  gasolinera repsol jaca ')).toEqual(['gasolinera repsol jaca'])
  })
})

describe('searchAddresses', () => {
  const VALENCIA: [number, number] = [-0.3763, 39.4699]
  const AVENUE = {
    lat: '39.4710',
    lon: '-0.3780',
    name: 'Avenida de Josep Ferrer',
    address: {
      road: 'Avenida de Josep Ferrer',
      town: 'València',
      state_district: 'Valencia',
      state: 'Comunidad Valenciana',
    },
  }
  // What Nominatim also gives for "josep ferrer": a dentist on another street with "Josep" in its name, and a pub
  // called "Avenida" on an avenue that has no "Josep" at all.
  const DENTIST = {
    lat: '39.4370',
    lon: '-0.4650',
    name: 'Clínica dental Ferrer',
    category: 'amenity',
    address: { road: 'Calle del Poeta Josep Valls', town: 'Torrent', state_district: 'Valencia' },
  }
  const PUB = { lat: '41.19', lon: '1.56', name: 'Avenida', category: 'amenity', address: { road: 'Avenida de España', town: 'Calafell' } }
  let requests: URLSearchParams[]
  let found: (q: string, params: URLSearchParams) => object[]

  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    requests = []
    found = (q) => (q === 'josep ferrer València' ? [AVENUE] : [])
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('places.json')) return new Response(JSON.stringify({ places: [['València', 'city', -0.3763, 39.4699, null]] }))
      const params = new URL(url).searchParams
      requests.push(params)
      return new Response(JSON.stringify(found(params.get('q') ?? '', params)))
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function search(query: string, near: [number, number] | null = VALENCIA) {
    const { searchAddresses } = await import('./geocoding')
    const [places] = await Promise.all([searchAddresses(query, near, 'es'), vi.runAllTimersAsync()])
    return places
  }

  it('falls back once, to the fewest words in the town of the bias point, and keeps to streets when a type is named', async () => {
    const places = await search('avenida escultor josep ferrer')
    expect(requests.map((params) => params.get('q'))).toEqual(['avenida escultor josep ferrer', 'josep ferrer València'])
    expect(requests.every((params) => params.get('layer') === 'address')).toBe(true)
    expect(places).toHaveLength(1)
    expect(places[0]).toMatchObject({ label: 'Avenida de Josep Ferrer', detail: 'València, Valencia' })
    expect(places[0].distanceM).toBeLessThan(500)
  })

  it('names the Galician town and the province as Nominatim tags them in Spain', async () => {
    found = () => [
      {
        lat: '42.8784',
        lon: '-8.5446',
        name: 'Rúa do Franco',
        address: {
          road: 'Rúa do Franco',
          municipality: 'Santiago de Compostela',
          state_district: 'La Coruña',
          state: 'Galicia',
        },
      },
    ]
    expect((await search('rua do franco santiago'))[0].detail).toBe('Santiago de Compostela, La Coruña')
  })

  it('searches points of interest first when no street type is named, and gives them when nothing names the query', async () => {
    const station = { lat: '42.57', lon: '-0.55', name: 'Repsol', category: 'amenity', address: { road: 'N-330', town: 'Jaca' } }
    found = (q) => (q === 'gasolinera repsol jaca' ? [station] : [])
    expect((await search('gasolinera repsol jaca')).map((place) => place.label)).toEqual(['Repsol'])
    expect(requests[0].has('layer')).toBe(false)
  })

  it('looks past an answer that only shares words with the query, among streets only', async () => {
    found = (q, params) => (q === 'escultor josep ferrer' ? [DENTIST] : q === 'josep ferrer València' && params.get('layer') === 'address' ? [AVENUE] : [])
    const places = await search('escultor josep ferrer')
    expect(requests.map((params) => [params.get('q'), params.get('layer')])).toEqual([
      ['escultor josep ferrer', null],
      ['josep ferrer València', 'address'],
    ])
    expect(places.map((place) => place.label)).toEqual(['Avenida de Josep Ferrer'])
  })

  it('passes over a place named like the street type', async () => {
    found = (q) => (q === 'Avenida escultor josep' ? [PUB] : q === 'josep València' ? [AVENUE] : [])
    const places = await search('Avenida escultor josep')
    expect(places[0].label).toBe('Avenida de Josep Ferrer')
  })

  it('falls back to the fewest words alone when the bias point is in no town, or the query names it', async () => {
    await search('avenida escultor josep ferrer', null)
    await search('calle josep ferrer valencia')
    expect(requests.map((params) => params.get('q'))).toEqual(['avenida escultor josep ferrer', 'josep ferrer', 'calle josep ferrer valencia', 'josep ferrer valencia'])
  })

  it('sends the bias point rounded to a tenth of a degree, never the exact position', async () => {
    await search('avenida escultor josep ferrer', [-0.3763, 39.4699])
    expect(requests[0].get('viewbox')).toBe('-1.4,40.5,0.6,38.5')
  })

  it('sends the first request without waiting for the rider, the later ones around the rider, with the distance from there', async () => {
    const RIDER: [number, number] = [-0.3763, 39.5024]
    const { searchAddresses } = await import('./geocoding')
    const rider = new Promise<[number, number]>((resolve) => setTimeout(() => resolve(RIDER), 5_000))
    const [places] = await Promise.all([searchAddresses('avenida escultor josep ferrer', [-1.28, 40.11], 'es', rider), vi.runAllTimersAsync()])
    expect(requests.map((params) => params.get('viewbox'))).toEqual(['-2.3,41.1,-0.3,39.1', '-1.4,40.5,0.6,38.5'])
    expect(places[0].distanceM).toBeGreaterThan(3_000)
    expect(places[0].distanceM).toBeLessThan(5_000)
  })

  it('leaves at least a second between requests', async () => {
    const { searchAddresses } = await import('./geocoding')
    const sentAt: number[] = []
    found = () => (sentAt.push(Date.now()), [])
    await Promise.all([searchAddresses('avenida escultor josep ferrer', VALENCIA, 'es'), vi.runAllTimersAsync()])
    expect(sentAt).toHaveLength(2)
    sentAt.slice(1).forEach((at, i) => expect(at - sentAt[i]).toBeGreaterThanOrEqual(1_000))
  })

  it('answers a repeated search from memory, measuring from the new bias point', async () => {
    await search('avenida escultor josep ferrer')
    const again = await search('Avenida Escultor Josep Ferrer', [VALENCIA[0] + 0.01, VALENCIA[1]])
    expect(requests).toHaveLength(2)
    expect(again[0].distanceM).toBeGreaterThan(500)
  })

  it('does not remember a failed search', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }))
    await expect(search('avenida josep ferrer')).rejects.toThrow('503')
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify([AVENUE])))
    expect(await search('avenida josep ferrer')).toHaveLength(1)
  })

  it.each([429, 403])('sends nothing for a minute after Nominatim answers %i, then searches again', async (status) => {
    const { searchAddresses } = await import('./geocoding')
    let sent = 0
    vi.stubGlobal('fetch', async () => (sent++, new Response('', { status })))
    const refused = searchAddresses('avenida escultor josep ferrer', VALENCIA, 'es')
    await Promise.all([expect(refused).rejects.toThrow(String(status)), vi.runAllTimersAsync()])
    expect(sent).toBe(1)
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(searchAddresses('avenida josep ferrer', VALENCIA, 'es')).rejects.toThrow('cooling down')
    expect(sent).toBe(1)
    await vi.advanceTimersByTimeAsync(30_000)
    vi.stubGlobal('fetch', async () => (sent++, new Response(JSON.stringify([AVENUE]))))
    expect(await searchAddresses('avenida josep ferrer', VALENCIA, 'es')).toHaveLength(1)
    expect(sent).toBe(2)
  })
})
