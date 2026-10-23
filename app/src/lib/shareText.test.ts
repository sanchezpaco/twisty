import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ isNative: false, share: vi.fn() }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.isNative } }))
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }))

import { shareText } from './shareText'

const content = { title: 'Jaca → Benasque', text: 'Jaca → Benasque, planned with Twisty\nhttps://maps.example/ride', dialogTitle: 'Share this ride' }

function stubNavigator(parts: Partial<Omit<Navigator, 'clipboard'>> & { clipboard?: Partial<Clipboard> }) {
  vi.stubGlobal('navigator', parts)
}

beforeEach(() => {
  native.isNative = false
  native.share.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.unstubAllGlobals())

describe('shareText', () => {
  it('hands the text to the Android share sheet, with no url that the apps would join again', async () => {
    native.isNative = true
    native.share.mockResolvedValue({})
    expect(await shareText(content)).toBe('shared')
    expect(native.share).toHaveBeenCalledWith({ title: content.title, text: content.text, dialogTitle: content.dialogTitle })
  })

  it('treats closing the Android sheet as nothing happening', async () => {
    native.isNative = true
    native.share.mockRejectedValue(new Error('Share canceled'))
    expect(await shareText(content)).toBe('cancelled')
  })

  it('uses the Web Share API where there is one, with the text only', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share })
    expect(await shareText(content)).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: content.title, text: content.text })
  })

  it('treats closing the web sheet as nothing happening, and copies nothing', async () => {
    const writeText = vi.fn()
    stubNavigator({ share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), clipboard: { writeText } })
    expect(await shareText(content)).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the whole text where there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ clipboard: { writeText } })
    expect(await shareText(content)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(content.text)
  })

  it('says so when the clipboard refuses', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    expect(await shareText(content)).toBe('copyFailed')
    stubNavigator({})
    expect(await shareText(content)).toBe('copyFailed')
  })

  it('falls back to the clipboard when the web sheet fails for another reason', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share: vi.fn().mockRejectedValue(new Error('NotAllowedError')), clipboard: { writeText } })
    expect(await shareText(content)).toBe('copied')
  })
})
