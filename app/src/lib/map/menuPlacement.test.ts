import { describe, expect, it } from 'vitest'
import { placeMenu } from './menuPlacement'

const MENU = { halfWidth: 100, height: 120, gap: 14 }
const ROOM = { minX: 108, maxX: 252, bottom: 700 }
const AT = { x: 180, y: 400 }

describe('where the map menu opens', () => {
  it('opens above the press when no pin is in the way', () => {
    expect(placeMenu(AT, [{ x: 40, y: 380 }], MENU, ROOM)).toEqual({ x: 180, below: false })
  })

  it('opens below when a pin would hide under it above', () => {
    expect(placeMenu(AT, [{ x: 250, y: 320 }], MENU, ROOM)).toEqual({ x: 180, below: true })
  })

  it('slides aside off the pin when there is no room below before the sheet', () => {
    const { x, below } = placeMenu({ x: 240, y: 400 }, [{ x: 330, y: 320 }], MENU, { ...ROOM, bottom: 500 })
    expect(below).toBe(false)
    expect(x).toBe(330 - 100 - 22)
  })

  it('stays put when no way is clear', () => {
    expect(placeMenu(AT, [{ x: 180, y: 320 }, { x: 180, y: 480 }], MENU, ROOM)).toEqual({ x: 180, below: false })
  })

  it('keeps the menu over the pressed point when sliding would leave it behind', () => {
    expect(placeMenu({ x: 120, y: 400 }, [{ x: 120, y: 330 }], MENU, { ...ROOM, bottom: 500 })).toEqual({ x: 120, below: false })
  })
})
