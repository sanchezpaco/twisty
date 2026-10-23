import { parseSavedRide, type SavedRide } from './savedRide'

export const STORAGE_KEY = 'twisty.saved'
/** Text under `STORAGE_KEY` that is not this store at all moves here, with the time, before anything is saved over it. */
export const UNREADABLE_PREFIX = 'twisty.saved.unreadable.'
export const STORE_VERSION = 1

export interface Folder {
  id: string
  name: string
  createdAt: number
}

/**
 * The rider's saved rides. Entries this version cannot read (written by a newer one, or half written) are kept as they
 * were and written back untouched: nothing the rider saved is ever dropped by an update.
 */
export interface SavedStore {
  folders: Folder[]
  rides: SavedRide[]
  unknownFolders: unknown[]
  unknownRides: unknown[]
}

export interface LoadedStore {
  store: SavedStore
  /** Why nothing may be saved, if so: a newer Twisty wrote the store (it is shown, never saved over), or there is no storage. */
  readOnly: 'newer' | 'unavailable' | null
  /** Text found under the key that is no store at all, kept aside before the first save. */
  unreadable: string | null
}

export type SaveResult = 'saved' | 'full' | 'newer' | 'unavailable'

export const EMPTY_STORE: SavedStore = { folders: [], rides: [], unknownFolders: [], unknownRides: [] }

export function parseStore(text: string | null): LoadedStore {
  if (text === null) return { store: EMPTY_STORE, readOnly: null, unreadable: null }
  const unreadable = { store: EMPTY_STORE, readOnly: null, unreadable: text }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return unreadable
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return unreadable
  const { version, folders, rides } = data as Record<string, unknown>
  if (typeof version !== 'number') return unreadable
  const readOnly = version > STORE_VERSION ? 'newer' : null
  // A store of this version with its lists missing is no store this version wrote: it is kept aside, not emptied.
  if (!readOnly && (!Array.isArray(folders) || !Array.isArray(rides))) return unreadable
  const store: SavedStore = { folders: [], rides: [], unknownFolders: [], unknownRides: [] }
  for (const entry of Array.isArray(folders) ? folders : []) {
    const folder = parseFolder(entry)
    if (folder) store.folders.push(folder)
    else store.unknownFolders.push(entry)
  }
  for (const entry of Array.isArray(rides) ? rides : []) {
    const ride = parseSavedRide(entry)
    if (ride) store.rides.push(ride)
    else store.unknownRides.push(entry)
  }
  return { store, readOnly, unreadable: null }
}

export function serializeStore(store: SavedStore): string {
  return JSON.stringify({
    version: STORE_VERSION,
    folders: [...store.folders, ...store.unknownFolders],
    rides: [...store.rides, ...store.unknownRides],
  })
}

export function loadStore(storage: Storage = localStorage): LoadedStore {
  try {
    return parseStore(storage.getItem(STORAGE_KEY))
  } catch {
    // Storage is unavailable: nothing can be saved either.
    return { store: EMPTY_STORE, readOnly: 'unavailable', unreadable: null }
  }
}

/** Writes the store under its own key, and nowhere else; nothing changes on the phone unless the whole store fits. */
export function saveStore(loaded: LoadedStore, store: SavedStore, storage: Storage = localStorage, now = Date.now()): SaveResult {
  if (loaded.readOnly) return loaded.readOnly
  try {
    if (loaded.unreadable !== null) {
      storage.setItem(UNREADABLE_PREFIX + now, loaded.unreadable)
      loaded.unreadable = null
    }
    storage.setItem(STORAGE_KEY, serializeStore(store))
    return 'saved'
  } catch {
    // A full quota (or private browsing): the previous store is still there.
    return 'full'
  }
}

/** Newest first. */
export function addRide(store: SavedStore, ride: SavedRide): SavedStore {
  return { ...store, rides: [ride, ...store.rides.filter((other) => other.id !== ride.id)] }
}

export function renameRide(store: SavedStore, id: string, name: string): SavedStore {
  return updateRide(store, id, (ride) => ({ ...ride, name: name.trim() || ride.name }))
}

export function moveRide(store: SavedStore, id: string, folderId: string | null): SavedStore {
  return updateRide(store, id, (ride) => ({ ...ride, folderId }))
}

export function deleteRide(store: SavedStore, id: string): SavedStore {
  return { ...store, rides: store.rides.filter((ride) => ride.id !== id) }
}

/** The folder of that name, ignoring case and accents, or null. */
export function folderNamed(store: SavedStore, name: string): Folder | null {
  const key = folderKey(name)
  return store.folders.find((folder) => folderKey(folder.name) === key) ?? null
}

/** A new folder, or the one that already has the name: there are never two "Pirineo". */
export function addFolder(store: SavedStore, name: string, id: string, now: number): { store: SavedStore; folder: Folder } {
  const existing = folderNamed(store, name)
  if (existing) return { store, folder: existing }
  const folder = { id, name: name.trim(), createdAt: now }
  return { store: { ...store, folders: [...store.folders, folder] }, folder }
}

/** Unchanged when the name is empty or another folder has it. */
export function renameFolder(store: SavedStore, id: string, name: string): SavedStore {
  const other = folderNamed(store, name)
  if (!name.trim() || (other && other.id !== id)) return store
  return { ...store, folders: store.folders.map((folder) => (folder.id === id ? { ...folder, name: name.trim() } : folder)) }
}

/** The folder goes and its rides stay, out of any folder: one tap never loses several rides. */
export function deleteFolder(store: SavedStore, id: string): SavedStore {
  return {
    ...store,
    folders: store.folders.filter((folder) => folder.id !== id),
    rides: store.rides.map((ride) => (ride.folderId === id ? { ...ride, folderId: null } : ride)),
  }
}

/** Folders by name in the rider's language. */
export function sortedFolders(store: SavedStore, locale: string): Folder[] {
  return [...store.folders].sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }))
}

/** The rides of a folder (null: in none), newest first; a ride whose folder is gone counts as in none. */
export function ridesIn(store: SavedStore, folderId: string | null): SavedRide[] {
  const folderIds = new Set(store.folders.map((folder) => folder.id))
  return store.rides
    .filter((ride) => (ride.folderId !== null && folderIds.has(ride.folderId) ? ride.folderId : null) === folderId)
    .sort((a, b) => b.savedAt - a.savedAt)
}

function updateRide(store: SavedStore, id: string, change: (ride: SavedRide) => SavedRide): SavedStore {
  return { ...store, rides: store.rides.map((ride) => (ride.id === id ? change(ride) : ride)) }
}

function folderKey(name: string): string {
  return name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase()
}

function parseFolder(value: unknown): Folder | null {
  if (typeof value !== 'object' || value === null) return null
  const { id, name, createdAt } = value as Record<string, unknown>
  if (typeof id !== 'string' || typeof name !== 'string' || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null
  return { id, name, createdAt }
}
