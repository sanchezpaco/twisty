/** What a toast offers to do about what it reports, such as Undo. */
export interface ToastAction {
  label: string
  run: () => void
}

interface ShownToast {
  id: number
  message: string
  /** A problem gets no check mark: nothing was done. */
  kind: 'done' | 'problem'
  action?: ToastAction
  /** The element the toast stands above, or below. */
  anchor: HTMLElement | null
  below: boolean
}

// One toast for the whole app, owned here and not by what raised it: a toast with Undo outlives the view it came from.
let shown = $state.raw<ShownToast | null>(null)
let count = 0

export const toasts = {
  get shown() {
    return shown
  },
}

export function showToast(message: string, anchor: HTMLElement | null, options: { kind?: 'done' | 'problem'; action?: ToastAction; below?: boolean } = {}): void {
  shown = { id: ++count, message, kind: options.kind ?? 'done', action: options.action, anchor, below: options.below ?? false }
}

export function clearToast(): void {
  shown = null
}
