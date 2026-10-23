/**
 * The soft keyboard resizes the WebView so the sheet rises above it, but resizing the map canvas stalls old phones
 * for hundreds of milliseconds each time. `--app-height` is the window's height while no field is being edited, and
 * the map and the sheet are sized from it, so they keep their size when the keyboard opens. `--keyboard-inset` is how
 * much of that height the keyboard takes, for whatever has to stay above it. A keyboard never changes the width, so a
 * resize that does (a foldable opening or closing) lets go of the hold.
 */
export function holdViewportHeight(): void {
  const root = document.documentElement.style
  let heldHeight = window.innerHeight
  let width = window.innerWidth
  const update = () => {
    const reshaped = window.innerWidth !== width
    width = window.innerWidth
    const editing = document.activeElement instanceof HTMLInputElement && !reshaped
    if (!editing) heldHeight = window.innerHeight
    const visual = window.visualViewport
    const inset = editing ? keyboardInset({ heldHeight, innerHeight: window.innerHeight, visualHeight: visual?.height, visualTop: visual?.offsetTop }) : 0
    root.setProperty('--app-height', `${heldHeight}px`)
    root.setProperty('--keyboard-inset', `${inset}px`)
  }
  update()
  window.addEventListener('resize', update)
  window.visualViewport?.addEventListener('resize', update)
}

/**
 * How much of the held height the keyboard covers. Android's WebView shrinks the window; iOS's keeps the window and
 * lays the keyboard over it, so there only the visual viewport shrinks.
 */
export function keyboardInset(view: { heldHeight: number; innerHeight: number; visualHeight?: number; visualTop?: number }): number {
  const shrunk = view.heldHeight - view.innerHeight
  const covered = view.visualHeight === undefined ? 0 : view.innerHeight - view.visualHeight - (view.visualTop ?? 0)
  return Math.round(Math.max(0, shrunk, covered))
}
