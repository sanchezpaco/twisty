/** Whether the device has a connection, as the browser says: planning and towns work without one, the map and street search do not. */
export const network = $state({ online: typeof navigator === 'undefined' || navigator.onLine })

/** Keeps `network` current while it runs; `onoffline` hears each time the connection drops. Returns the way to stop. */
export function watchNetwork(onoffline: () => void): () => void {
  const online = () => (network.online = true)
  const offline = () => {
    network.online = false
    onoffline()
  }
  addEventListener('online', online)
  addEventListener('offline', offline)
  return () => {
    removeEventListener('online', online)
    removeEventListener('offline', offline)
  }
}

/** The street search row under a query long enough for it: offered, or said to need a connection; null when not due. */
export function streetSearchRow(due: boolean, online: boolean): 'offer' | 'offline' | null {
  if (!due) return null
  return online ? 'offer' : 'offline'
}
