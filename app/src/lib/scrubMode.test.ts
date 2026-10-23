import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONFIRM_DRAGS,
  type Drag,
  GRACE_FRAMES,
  JUDGED_FRAMES,
  loadScrubMemory,
  nextFrame,
  parseScrubMemory,
  rememberDrag,
  saveScrubMemory,
  type ScrubMemory,
  serializeScrubMemory,
  startDrag,
} from './scrubMode'

const BUILD = 'index-abc.js'
const fresh: ScrubMemory = { build: BUILD, lightDrags: 0 }
const drag = (deltas: number[], memory = fresh): Drag => deltas.reduce(nextFrame, startDrag(memory))
const smooth = (frames: number) => Array<number>(frames).fill(17)

// Frame times of a 2 s scrub on the Huawei in full mode: one map redraw alone is about 33 ms there.
const HUAWEI = [120, 67, 17, 33, 67, 17, 50, 83, 17, 33, 67, 100, 17, 33, 67]
// The Fold at 120 Hz, with one garbage collection.
const FOLD = [...Array<number>(20).fill(8), 70, ...Array<number>(40).fill(8)]

describe('a drag of the slider', () => {
  it('goes light on its third slow frame', () => {
    const steps = HUAWEI.reduce<Drag[]>((all, delta) => [...all, nextFrame(all.at(-1) ?? startDrag(fresh), delta)], [])
    expect(steps.findIndex((step) => step.light)).toBe(10)
  })

  it('stays full on a phone that keeps up, through a stray slow frame', () => {
    expect(drag(FOLD).light).toBe(false)
  })

  it('leaves out the first frames, which the touch itself makes slow', () => {
    expect(drag([...Array<number>(GRACE_FRAMES).fill(200), 17, 67, 67]).light).toBe(false)
  })

  it('never goes back to full once light', () => {
    expect(drag([...HUAWEI, ...smooth(100)]).light).toBe(true)
  })

  it('starts light on a device remembered as light', () => {
    expect(startDrag({ build: BUILD, lightDrags: CONFIRM_DRAGS }).light).toBe(true)
  })
})

describe('what the device remembers', () => {
  it('remembers a device as light only after drags in a row went light', () => {
    const once = rememberDrag(fresh, drag(HUAWEI))
    expect(startDrag(once).light).toBe(false)
    const twice = rememberDrag(once, drag(HUAWEI))
    expect(startDrag(twice).light).toBe(true)
  })

  it('forgets a light drag when a long enough drag keeps up in between', () => {
    const once = rememberDrag(fresh, drag(HUAWEI))
    expect(rememberDrag(once, drag(smooth(JUDGED_FRAMES)))).toEqual(fresh)
  })

  it('learns nothing from a drag too short to judge', () => {
    const once = rememberDrag(fresh, drag(HUAWEI))
    expect(rememberDrag(once, drag(smooth(JUDGED_FRAMES - 1)))).toEqual(once)
  })

  it('learns nothing from a drag that started light', () => {
    const light = { build: BUILD, lightDrags: CONFIRM_DRAGS }
    expect(rememberDrag(light, drag(smooth(100), light))).toEqual(light)
  })

  it('reads back what it wrote', () => {
    const memory = { build: BUILD, lightDrags: 2 }
    expect(parseScrubMemory(serializeScrubMemory(memory), BUILD)).toEqual(memory)
  })

  it('measures afresh on another build', () => {
    expect(parseScrubMemory(serializeScrubMemory({ build: 'index-old.js', lightDrags: 5 }), BUILD)).toEqual(fresh)
  })

  it('starts afresh from anything odd in storage', () => {
    for (const text of [null, '', 'not json', '42', '{"build":"index-abc.js","lightDrags":-1}', '{"build":"index-abc.js","lightDrags":1.5}']) {
      expect(parseScrubMemory(text, BUILD)).toEqual(fresh)
    }
  })
})

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals())

  const storage = () => {
    const items = new Map<string, string>()
    return {
      items,
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    }
  }

  it('keeps no key for a device that never went light', () => {
    const local = storage()
    vi.stubGlobal('localStorage', local)
    saveScrubMemory(rememberDrag(fresh, drag(FOLD)))
    expect(local.items.size).toBe(0)
  })

  it('keeps a light device across launches of the same build', () => {
    vi.stubGlobal('localStorage', storage())
    saveScrubMemory({ build: BUILD, lightDrags: CONFIRM_DRAGS })
    expect(startDrag(loadScrubMemory(BUILD)).light).toBe(true)
  })

  it('still lets each drag go light when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    const memory = loadScrubMemory(BUILD)
    expect(memory).toEqual(fresh)
    expect(() => saveScrubMemory(rememberDrag(memory, drag(HUAWEI)))).not.toThrow()
    expect(drag(HUAWEI, memory).light).toBe(true)
  })
})
