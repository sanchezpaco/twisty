import { describe, expect, it } from 'vitest'
import type { SavedRide } from './savedRide'
import {
  addFolder,
  addRide,
  deleteFolder,
  deleteRide,
  EMPTY_STORE,
  folderNamed,
  loadStore,
  moveRide,
  parseStore,
  renameFolder,
  renameRide,
  ridesIn,
  saveStore,
  serializeStore,
  sortedFolders,
  STORAGE_KEY,
  UNREADABLE_PREFIX,
} from './savedRides'

const ride = (id: string, savedAt = 1, folderId: string | null = null): SavedRide => ({
  id,
  name: `Ride ${id}`,
  folderId,
  savedAt,
  from: { label: 'Jaca', position: [-0.55, 42.57] },
  to: { label: 'Benasque', position: [0.52, 42.61] },
  via: [],
  dataAt: '2026-10-18T13:54:12+00:00',
  ride: {
    timeS: 9300,
    extraS: 2640,
    distanceM: 149_000,
    curvyM: 40_000,
    twistyM: 56_000,
    motorwayM: 84_000,
    trackM: 0,
    otherM: 9_000,
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1',
    pinnedAll: true,
    legs: [{ timeS: 9300, distanceM: 149_000, twistyM: 56_000, curvyM: 40_000 }],
    coverageRoad: null,
    segments: [{ kind: 'twisty', line: '_p~iF~ps|U', rating: 4 }],
    twisties: [{ label: 'N-260', lengthM: 12_000, rating: 4, narrowM: 0, postedKmh: null, fordCount: 0, line: '_p~iF~ps|U', leg: 0 }],
  },
})

/** A `localStorage` that records every key written, and can be made to run out of room. */
function storage(initial: Record<string, string> = {}, full = false) {
  const items = new Map(Object.entries(initial))
  const written: string[] = []
  const stub = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (full) throw new DOMException('quota', 'QuotaExceededError')
      written.push(key)
      items.set(key, value)
    },
    removeItem: (key: string) => {
      written.push(key)
      items.delete(key)
    },
  } as unknown as Storage
  return { stub, items, written }
}

describe('the store', () => {
  it('reads back what it wrote', () => {
    const { store } = addFolder(addRide(EMPTY_STORE, ride('a')), 'Pirineo', 'f1', 5)
    const loaded = parseStore(serializeStore(store))
    expect(loaded).toMatchObject({ readOnly: null, unreadable: null })
    expect(loaded.store.rides).toEqual(store.rides)
    expect(loaded.store.folders).toEqual([{ id: 'f1', name: 'Pirineo', createdAt: 5 }])
  })

  it('keeps entries it cannot read and writes them back untouched', () => {
    const future = { id: 'x', name: 'From a newer Twisty', shape: 'unknown' }
    const text = JSON.stringify({ version: 1, folders: [{ id: 'f9' }], rides: [ride('a'), future] })
    const loaded = parseStore(text)
    expect(loaded.store.rides.map((entry) => entry.id)).toEqual(['a'])
    const written = JSON.parse(serializeStore(addRide(loaded.store, ride('b', 2))))
    expect(written.rides).toContainEqual(future)
    expect(written.folders).toContainEqual({ id: 'f9' })
  })

  it('shows a store from a newer Twisty and never saves over it', () => {
    const text = JSON.stringify({ version: 2, folders: [], rides: [ride('a')] })
    const { stub, items, written } = storage({ [STORAGE_KEY]: text })
    const loaded = loadStore(stub)
    expect(loaded.readOnly).toBe('newer')
    expect(loaded.store.rides).toHaveLength(1)
    expect(saveStore(loaded, addRide(loaded.store, ride('b')), stub)).toBe('newer')
    expect(written).toEqual([])
    expect(items.get(STORAGE_KEY)).toBe(text)
  })

  it('moves text that is no store aside before the first save, and only then', () => {
    const { stub, items, written } = storage({ [STORAGE_KEY]: 'not json{' })
    const loaded = loadStore(stub)
    expect(loaded.store).toEqual(EMPTY_STORE)
    expect(saveStore(loaded, addRide(loaded.store, ride('a')), stub, 42)).toBe('saved')
    expect(items.get(UNREADABLE_PREFIX + 42)).toBe('not json{')
    saveStore(loaded, addRide(loaded.store, ride('b')), stub, 43)
    expect(written).toEqual([UNREADABLE_PREFIX + 42, STORAGE_KEY, STORAGE_KEY])
  })

  it('keeps a store of this version with its lists missing aside, rather than emptying it', () => {
    const text = JSON.stringify({ version: 1, rides: { a: ride('a') } })
    const { stub, items } = storage({ [STORAGE_KEY]: text })
    const loaded = loadStore(stub)
    expect(loaded.unreadable).toBe(text)
    saveStore(loaded, addRide(loaded.store, ride('b')), stub, 7)
    expect(items.get(UNREADABLE_PREFIX + 7)).toBe(text)
  })

  it('says when there is no storage at all', () => {
    const broken = { getItem: () => { throw new DOMException('denied', 'SecurityError') } } as unknown as Storage
    const loaded = loadStore(broken)
    expect(loaded.readOnly).toBe('unavailable')
    expect(saveStore(loaded, addRide(loaded.store, ride('a')), broken)).toBe('unavailable')
  })

  it('writes its own key and no other: the trip and the recent trips stay as they are', () => {
    const trip = '{"from":null}'
    const trips = '[{"handed":true}]'
    const { stub, items, written } = storage({ 'twisty.trip': trip, 'twisty.trips': trips })
    const loaded = loadStore(stub)
    let store = addRide(loaded.store, ride('a'))
    store = addFolder(store, 'Pirineo', 'f1', 1).store
    for (const next of [store, moveRide(store, 'a', 'f1'), renameRide(store, 'a', 'Morning'), deleteFolder(store, 'f1'), deleteRide(store, 'a')]) {
      saveStore(loaded, next, stub)
    }
    expect(new Set(written)).toEqual(new Set([STORAGE_KEY]))
    expect(items.get('twisty.trip')).toBe(trip)
    expect(items.get('twisty.trips')).toBe(trips)
  })

  it('changes nothing when the phone has no room left', () => {
    const before = serializeStore(addRide(EMPTY_STORE, ride('a')))
    const { stub, items } = storage({ [STORAGE_KEY]: before }, true)
    const loaded = loadStore(stub)
    expect(saveStore(loaded, addRide(loaded.store, ride('b')), stub)).toBe('full')
    expect(items.get(STORAGE_KEY)).toBe(before)
  })
})

describe('rides and folders', () => {
  it('keeps the newest ride first and a ride once', () => {
    const store = addRide(addRide(addRide(EMPTY_STORE, ride('a', 1)), ride('b', 2)), ride('a', 3))
    expect(store.rides.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('keeps a ride’s name when the new one is blank', () => {
    expect(renameRide(addRide(EMPTY_STORE, ride('a')), 'a', '  ').rides[0].name).toBe('Ride a')
    expect(renameRide(addRide(EMPTY_STORE, ride('a')), 'a', ' Morning ').rides[0].name).toBe('Morning')
  })

  it('never makes two folders of one name, whatever the case and accents', () => {
    const first = addFolder(EMPTY_STORE, 'Pirineo', 'f1', 1)
    const again = addFolder(first.store, '  pirinéo ', 'f2', 2)
    expect(again.folder.id).toBe('f1')
    expect(again.store.folders).toHaveLength(1)
    expect(folderNamed(again.store, 'PIRINEO')?.id).toBe('f1')
  })

  it('renames a folder unless another one has the name', () => {
    let store = addFolder(EMPTY_STORE, 'Pirineo', 'f1', 1).store
    store = addFolder(store, 'Domingos', 'f2', 2).store
    expect(renameFolder(store, 'f2', 'pirineo')).toBe(store)
    expect(renameFolder(store, 'f2', '')).toBe(store)
    expect(renameFolder(store, 'f1', 'Pirineos').folders[0].name).toBe('Pirineos')
  })

  it('keeps the rides of a deleted folder, out of any folder', () => {
    let store = addFolder(EMPTY_STORE, 'Pirineo', 'f1', 1).store
    store = addRide(addRide(store, ride('a', 1, 'f1')), ride('b', 2, 'f1'))
    const after = deleteFolder(store, 'f1')
    expect(after.folders).toEqual([])
    expect(ridesIn(after, null).map((entry) => entry.id)).toEqual(['b', 'a'])
  })

  it('lists the rides of a folder newest first, and those of a missing folder as in none', () => {
    const store = { ...addFolder(EMPTY_STORE, 'Pirineo', 'f1', 1).store }
    const full = addRide(addRide(addRide(store, ride('a', 1, 'f1')), ride('b', 3, 'f1')), ride('c', 2, 'gone'))
    expect(ridesIn(full, 'f1').map((entry) => entry.id)).toEqual(['b', 'a'])
    expect(ridesIn(full, null).map((entry) => entry.id)).toEqual(['c'])
  })

  it('sorts folders by name in the rider’s language', () => {
    let store = EMPTY_STORE
    for (const [name, id] of [['Ávila', 'a'], ['domingos', 'b'], ['Benasque', 'c']]) store = addFolder(store, name, id, 1).store
    expect(sortedFolders(store, 'es').map((folder) => folder.name)).toEqual(['Ávila', 'Benasque', 'domingos'])
  })
})
