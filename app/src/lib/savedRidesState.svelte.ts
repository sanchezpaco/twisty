import { i18n } from './i18n/i18n.svelte'
import { loadStore, type SavedStore, type SaveResult, saveStore } from './savedRides'
import { clearToast, showToast } from './toastState.svelte'

const loaded = loadStore()
let store = $state.raw<SavedStore>(loaded.store)
/** Riders file several rides in a row into one folder: the save sheet offers the last one first. */
let lastFolderId = $state<string | null>(null)

/** The rider's saved rides, shared by the ride's save button, the start screen and the list. */
export const savedRides = {
  get store() {
    return store
  },
  /** Why nothing may be saved, if so: a newer Twisty wrote the store, or there is no storage. */
  get readOnly() {
    return loaded.readOnly
  },
  get lastFolderId() {
    return lastFolderId
  },
}

/** Keeps the store as it is after a change, or keeps the previous one when the phone has no room or it is read-only. */
export function commitSaved(next: SavedStore): SaveResult {
  const result = saveStore(loaded, next)
  if (result === 'saved') store = next
  return result
}

export function rememberFolder(folderId: string | null): void {
  lastFolderId = folderId
}

/**
 * Commits a change and says how it went next to `anchor`. Only the latest change can be undone: a new change takes
 * the previous toast away, so an Undo never reverts a rename or a move made after it.
 */
export function changeSaved(next: SavedStore, done: string | null, anchor: HTMLElement | null): SaveResult {
  const before = store
  const result = commitSaved(next)
  if (result !== 'saved') showToast(i18n.t.saved.notSaved[result], anchor, { kind: 'problem' })
  else if (done) showToast(done, anchor, { action: { label: i18n.t.saved.undo, run: () => commitSaved(before) } })
  else clearToast()
  return result
}
