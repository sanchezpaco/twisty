import { describe, expect, it } from 'vitest'
import { keyboardInset } from './viewport'

describe('keyboardInset', () => {
  it('is what the keyboard took from the window on Android, where the WebView shrinks', () => {
    expect(keyboardInset({ heldHeight: 780, innerHeight: 470, visualHeight: 470, visualTop: 0 })).toBe(310)
  })

  // Measured on an iPhone 13 mini: the window stays 812 high and the visual viewport drops to 400 under the keyboard.
  it('is what the keyboard covers on iOS, where only the visual viewport shrinks', () => {
    expect(keyboardInset({ heldHeight: 812, innerHeight: 812, visualHeight: 400, visualTop: 0 })).toBe(412)
  })

  it('is nothing with the keyboard down, or where there is no visual viewport', () => {
    expect(keyboardInset({ heldHeight: 780, innerHeight: 780, visualHeight: 780, visualTop: 0 })).toBe(0)
    expect(keyboardInset({ heldHeight: 780, innerHeight: 780 })).toBe(0)
  })
})
