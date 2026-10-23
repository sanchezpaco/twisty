/** How long a field still counts as focused after it loses focus, so a tap on its own list lands before the list closes. */
export const BLUR_SETTLE_MS = 150

/**
 * Whether a field counts as focused. Losing focus is reported late (see `BLUR_SETTLE_MS`), and a focus that comes back
 * in the meantime cancels it: a field that opens its search can lose and regain focus while it moves.
 */
export function createFieldFocus(onchange: (focused: boolean) => void) {
  let pendingBlur: ReturnType<typeof setTimeout> | undefined

  return {
    focus() {
      clearTimeout(pendingBlur)
      onchange(true)
    },
    blur() {
      pendingBlur = setTimeout(() => onchange(false), BLUR_SETTLE_MS)
    },
  }
}
