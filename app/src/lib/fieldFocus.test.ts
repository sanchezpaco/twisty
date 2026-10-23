import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLUR_SETTLE_MS, createFieldFocus } from './fieldFocus'

describe('createFieldFocus', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const tracked = () => {
    const states: boolean[] = []
    return { states, field: createFieldFocus((focused) => states.push(focused)) }
  }

  it('reports focus at once and its loss only once the blur has settled', () => {
    const { states, field } = tracked()
    field.focus()
    field.blur()
    expect(states).toEqual([true])
    vi.advanceTimersByTime(BLUR_SETTLE_MS)
    expect(states).toEqual([true, false])
  })

  // On the Huawei a field that opened its search lost focus for 13 ms; the late blur then closed the list on a focused field.
  it('keeps a field focused when the focus comes back before the blur settles', () => {
    const { states, field } = tracked()
    field.focus()
    field.blur()
    vi.advanceTimersByTime(13)
    field.focus()
    vi.advanceTimersByTime(BLUR_SETTLE_MS * 2)
    expect(states.at(-1)).toBe(true)
  })
})
