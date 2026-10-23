// Headless Chrome helpers for the store captures: a phone viewport, the app's language, towns picked from the offline
// index, and waits for the plan and the camera. Nominatim is never called: the store shots use towns only.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(HERE, '../..')
const require = createRequire(path.join(REPO, 'app/package.json'))
export const puppeteer = require('puppeteer-core')

export const URL = process.env.TWISTY_URL ?? 'http://localhost:4327/'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
/** The performance-bar phone's viewport: 1080x2340 captures. */
export const PHONE = { width: 360, height: 780, deviceScaleFactor: 3 }
/** The README's desktop window and the Z Fold opened (the app shows its side panel on both). */
export const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false }
export const FOLD_OPEN = { width: 884, height: 780, deviceScaleFactor: 2.625 }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run'],
  })
}

/** A fresh context and page at a viewport, in a language. */
export async function openSession(browser, lang, viewport = PHONE) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  // A viewport says `isMobile: false` for a desktop window: a mouse and no touch, Chrome's own user agent.
  const touch = viewport.isMobile !== false
  await page.setViewport({ isMobile: touch, hasTouch: touch, ...viewport })
  if (touch) await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36')
  await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('twisty.locale', l) } catch {} }, lang)
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)))
  page.tileFailures = 0
  page.on('requestfailed', (r) => { if (!/nominatim/.test(r.url())) page.tileFailures++ })
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) page.tileFailures++ })
  await page.setRequestInterception(true)
  page.on('request', (req) => (/nominatim/.test(req.url()) ? req.abort() : req.continue()))
  // A page Chrome thinks is in the background gets few animation frames: the camera's flight to the route then never
  // ends and the route is not drawn. Focused, it flies on the first try.
  await page.bringToFront()
  const cdp = await page.createCDPSession()
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  return { context, page }
}

export async function ready(page) {
  await page.waitForSelector('input[data-role="from"]', { timeout: 60000 })
  // The road network loads after the page: a trip asked for before it is there waits for it, past the plan's timeout.
  await page.waitForFunction(() => !document.querySelector('.engine'), { timeout: 240000 })
  await page.waitForNetworkIdle({ idleTime: 2500, timeout: 60000 }).catch(() => {})
  await sleep(2000)
}

/** Waits until the map has no tiles in flight and has painted a few frames. */
export async function mapIdle(page, extraMs = 2500) {
  await page.waitForNetworkIdle({ idleTime: 2000, timeout: 60000 }).catch(() => {})
  await sleep(extraMs)
}

/**
 * Waits until the map stops changing: four frames three seconds apart are the same picture. On a busy machine the
 * tiles arrive long before they are parsed and drawn: a network-idle wait, or two equal frames, let shots through
 * without the base map. The markers' pulse is paused meanwhile.
 */
export async function settleMap(page, { timeout = 120000, gapMs = 3000, equalFrames = 3 } = {}) {
  const pause = await page.addStyleTag({ content: '*, *::before, *::after { animation-play-state: paused !important; }' })
  const t0 = Date.now()
  let last = null
  let same = 0
  while (Date.now() - t0 < timeout && same < equalFrames) {
    await sleep(gapMs)
    const frame = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 40 }))
    same = last && frame.equals(last) ? same + 1 : 0
    last = frame
  }
  await pause.evaluate((el) => el.remove())
  await sleep(300)
  return same >= equalFrames
}

export async function tapEl(page, h) {
  const b = await h.boundingBox()
  if (!b) throw new Error('element not visible')
  // A desktop window has no touch screen: a click there.
  if (page.viewport().hasTouch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
}

export async function tapSel(page, sel) {
  const h = await page.waitForSelector(sel, { visible: true, timeout: 10000 })
  await tapEl(page, h)
}

export async function typeInField(page, role, text, index) {
  const sel = `input[data-role="${role}"]` + (index !== undefined ? `[data-index="${index}"]` : '')
  const el = await page.waitForSelector(sel, { visible: true })
  await tapEl(page, el).catch(() => {})
  await el.focus()
  await el.evaluate((e) => e.select())
  await page.keyboard.press('Backspace')
  await page.keyboard.type(text, { delay: 60 })
  await sleep(600)
}

export async function options(page) {
  return page.$$eval('ul.suggestions li[role=option] button', (bs) => bs.map((b) => ({ label: b.querySelector('.label')?.textContent?.trim() ?? b.textContent.trim(), detail: b.querySelector('.detail')?.textContent?.trim() ?? '' })))
}

export async function tapOption(page, labelRe) {
  for (const h of await page.$$('ul.suggestions li[role=option] button')) {
    const t = await h.evaluate((e) => e.querySelector('.label')?.textContent?.trim() ?? '')
    if (labelRe.test(t)) { await tapEl(page, h); return t }
  }
  throw new Error('option not found ' + labelRe + ' in ' + JSON.stringify(await options(page)))
}

/** Types a town and taps it in the offline list; on a busy machine the list can be slow, so it types once more. */
export async function pickPlace(page, role, query, labelRe, index) {
  for (let attempt = 1; ; attempt++) {
    await typeInField(page, role, query, index)
    try {
      await page.waitForSelector('ul.suggestions li[role=option] .label', { timeout: 20000 })
      return await tapOption(page, labelRe)
    } catch (e) {
      if (attempt === 2) throw e
    }
  }
}

/** Waits for the plan to finish: the actions shown, the planning and refining indicators gone. */
export async function waitPlanned(page, timeout = 240000) {
  const t0 = Date.now()
  await sleep(1000)
  while (Date.now() - t0 < timeout) {
    const st = await page.evaluate(() => ({
      planning: !!document.querySelector('.planning'),
      refining: !!document.querySelector('.refining'),
      error: document.querySelector('.error')?.textContent?.trim() ?? null,
      actions: !!document.querySelector('.cta'),
    }))
    if (st.error) return { error: st.error }
    if (st.actions && !st.planning && !st.refining) return { ok: true }
    await sleep(500)
  }
  return { timeout: true }
}

const markerBox = (page) => page.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y)] }
  // A loop has one pin for both ends.
  return [r('.place-marker--from .place-marker__dot, .place-marker--loop .place-marker__dot'), r('.place-marker--to .place-marker__dot, .place-marker--loop .place-marker__dot')]
})

const MOVED_PX = 70
const APART_FRACTION = 0.35

/** Where the start's marker stands at the Spain view, to tell later whether the camera flew to the route. */
export async function noteSpainView(page) {
  await sleep(3000)
  page.spainA = (await markerBox(page))[0]
}

/**
 * Waits until the camera has flown to the route and stopped. If it stays at the Spain view, the caller retries in a
 * fresh context; it never draws the route itself. A desktop window drawn in software flies slowly on a busy machine:
 * at 20 s most README tries gave up mid-flight.
 */
export async function waitFramed(page, timeout = 60000) {
  const t0 = Date.now()
  let last = ''
  let stable = 0
  while (Date.now() - t0 < timeout) {
    const [a, b] = await markerBox(page)
    const key = JSON.stringify([a, b])
    const moved = a && page.spainA && (Math.hypot(a[0] - page.spainA[0], a[1] - page.spainA[1]) > MOVED_PX || (b && Math.hypot(a[0] - b[0], a[1] - b[1]) > APART_FRACTION * page.viewport().width))
    stable = key === last && moved ? stable + 1 : 0
    last = key
    if (stable >= 3) return true
    await sleep(800)
  }
  return false
}
