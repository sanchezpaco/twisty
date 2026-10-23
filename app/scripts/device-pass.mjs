// The device pass in one command: cold start to overlay, idle frames, memory, the trip editor with a real keyboard, and
// the first 3D toggle. One phone at a time, and only `com.sanchezpaco.twisty` is ever touched (never other packages).
//   node scripts/device-pass.mjs --phone <adb serial> [--out dir] [--only cold,idle,editor,terrain] [--cold-runs 5]
//   node scripts/device-pass.mjs --launch http://localhost:4173/     headless Chrome: the page checks only, no adb steps
// Build and install the APK first (`make install`, with the director's OK for the phone). Output: one JSON line per
// measurement, screenshots in --out, and "MANUAL" lines for what a script cannot judge.
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback }
const phone = arg('phone')
const launch = arg('launch')
if (!phone === !launch) throw new Error('Give exactly one of --phone <adb serial> or --launch <url>')
const out = arg('out', join(import.meta.dirname, '../../data/device-pass'))
const only = arg('only', 'cold,idle,editor,terrain').split(',')
const coldRuns = Number(arg('cold-runs', 5))
const PACKAGE = 'com.sanchezpaco.twisty'
const ACTIVITY = `${PACKAGE}/.MainActivity`
const DEVTOOLS_PORT = 9333
const IDLE_WINDOW_MS = 6000
/** Tiles and the first frames after a launch are work, not idling. */
const IDLE_SETTLE_MS = 8000
/** From this width the places are a side panel with dropdowns, not a full-screen editor (see lib/layout.ts). */
const SIDE_PANEL_MIN_WIDTH = 700
/** A frame of 60 Hz is 16.7 ms: the pass fails an interaction whose longest main-thread task passes this. */
const FRAME_BUDGET_MS = 50
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
/** Planning a trip on the phone takes seconds: the editor closes at once, the ride a little later. */
const TRIP_WAIT_MS = 30_000
const SETTLE_MS = 2000
const PLAN_SETTLE_MS = 10_000
const TRIP = { from: 'Jaca', to: 'Benasque' }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const adb = (...args) => spawnSync('adb', ['-s', phone, ...args], { encoding: 'utf8' }).stdout ?? ''
const report = (name, data) => console.log(JSON.stringify({ step: name, ...data }))
const manual = (text) => console.log(`MANUAL ${text}`)
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
mkdirSync(out, { recursive: true })

async function openPage() {
  if (launch) {
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
    const page = await browser.newPage()
    await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
    await page.goto(launch)
    return { browser, page }
  }
  let socket
  for (let attempt = 0; attempt < 40 && !socket; attempt++) {
    const pid = adb('shell', 'pidof', PACKAGE).trim()
    socket = adb('shell', 'cat', '/proc/net/unix').split('\n').map((line) => line.trim().split(' ').pop()).find((name) => pid && name?.startsWith(`@webview_devtools_remote_${pid}`))
    if (!socket) await sleep(250)
  }
  if (!socket) throw new Error('No WebView devtools socket: is this a debug build?')
  adb('forward', `tcp:${DEVTOOLS_PORT}`, `localabstract:${socket.slice(1)}`)
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${DEVTOOLS_PORT}`, defaultViewport: null })
  const page = (await browser.pages()).find((candidate) => candidate.url().startsWith('https://localhost')) ?? (await browser.pages())[0]
  return { browser, page }
}

/** Long tasks since the page began: the observer is buffered, so it can be installed after the fact. */
const longTasks = (page) => page.evaluate(() => new Promise((resolve) => {
  const seen = []
  new PerformanceObserver((list) => seen.push(...list.getEntries().map((e) => [Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true })
  setTimeout(() => resolve(seen), 50)
}))

// --- Input. On the phone every tap is a real adb tap, so the soft keyboard behaves as it does for a rider.
let origin = { x: 0, y: 0 }
let scale = 1
async function calibrate(page) {
  scale = await page.evaluate(() => window.devicePixelRatio)
  if (launch) return
  await page.evaluate(() => { window.__taps = []; addEventListener('pointerdown', (e) => window.__taps.push([e.clientX, e.clientY]), true) })
  const probe = { x: 180, y: 300 }
  adb('shell', 'input', 'tap', String(Math.round(probe.x * scale)), String(Math.round(probe.y * scale)))
  await sleep(300)
  const [seenX, seenY] = (await page.evaluate(() => window.__taps)).at(-1)
  origin = { x: Math.round(probe.x * scale - seenX * scale), y: Math.round(probe.y * scale - seenY * scale) }
  report('calibration', { scale, originPx: origin })
}
async function tap(page, selector) {
  const box = await (await page.waitForSelector(selector, { visible: true, timeout: 10_000 })).boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  if (launch) return page.touchscreen.tap(x, y)
  adb('shell', 'input', 'tap', String(Math.round(x * scale + origin.x)), String(Math.round(y * scale + origin.y)))
}
/** Setup, not part of what is measured: the × of a field forgets the place, which deleting its text does not. */
const clearPlace = (page, role) => page.evaluate((selector) => document.querySelector(selector)?.closest('.field')?.querySelector('.clear')?.click(), `input[data-role="${role}"]`)
const typeText = (page, text) => (launch ? page.keyboard.type(text, { delay: 30 }) : Promise.resolve(adb('shell', 'input', 'text', text.replace(/ /g, '%s'))))
const BLANK_KEYS = 30
/** Empties the focused field: end of line, then backspace. A saved trip comes back with its places filled in. */
const clearField = (page) => (launch ? page.keyboard.press('Control+A').then(() => page.keyboard.press('Backspace')) : Promise.resolve(adb('shell', 'input', 'keyevent', '123', ...Array(BLANK_KEYS).fill('67'))))
/** The fields are hidden while a ride is shown: the trip row opens the editor from there. */
const openField = async (page, role) => {
  const field = `input[data-role="${role}"]`
  const hidden = await page.evaluate((selector) => !document.querySelector(selector)?.offsetParent, field)
  await tap(page, hidden ? `.trip button:${role === 'from' ? 'first' : 'last'}-child` : field)
}
const goBack = (page) => (launch ? page.keyboard.press('Escape') : Promise.resolve(adb('shell', 'input', 'keyevent', '4')))
async function shot(page, name) {
  if (launch) return page.screenshot({ path: join(out, `${name}.png`) })
  adb('shell', 'screencap', '-p', `/sdcard/${name}.png`)
  adb('pull', `/sdcard/${name}.png`, join(out, `${name}.png`))
  adb('shell', 'rm', `/sdcard/${name}.png`)
}

const state = (page) => page.evaluate(() => {
  const root = getComputedStyle(document.documentElement)
  const active = document.activeElement
  const list = document.querySelector('.suggestions')
  return {
    keyboardInsetPx: parseFloat(root.getPropertyValue('--keyboard-inset')) || 0,
    innerHeight,
    focused: active instanceof HTMLInputElement ? active.dataset.role : null,
    suggestions: list ? [...list.querySelectorAll('li')].length : 0,
    listBottom: list ? Math.round((list.closest('.editor-list') ?? list).getBoundingClientRect().bottom) : null,
    editorOpen: !!document.querySelector('.panel--editor'),
  }
})

// --- Steps
async function cold() {
  const runs = []
  for (let run = 0; run < coldRuns; run++) {
    if (phone) {
      adb('shell', 'am', 'force-stop', PACKAGE)
      await sleep(1500)
    }
    const started = phone ? adb('shell', 'am', 'start', '-W', '-n', ACTIVITY) : ''
    const launchMs = Number(/TotalTime: (\d+)/.exec(started)?.[1] ?? NaN)
    const { browser, page } = await openPage()
    await page.waitForFunction(() => performance.getEntriesByType('resource').some((r) => r.name.includes('/data/overlay/') && r.responseEnd > 0), { timeout: 60_000 })
    await sleep(2500)
    const timing = await page.evaluate(() => {
      const tiles = performance.getEntriesByType('resource').filter((r) => r.name.includes('/data/overlay/'))
      return { firstTileMs: Math.round(Math.min(...tiles.map((r) => r.responseEnd))), tiles: tiles.length, firstPaintMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? NaN) }
    })
    const tasks = await longTasks(page)
    runs.push({ launchMs, ...timing, longestMs: Math.max(0, ...tasks.map(([, d]) => d)), totalMs: tasks.reduce((sum, [, d]) => sum + d, 0) })
    report('cold', { run, ...runs.at(-1) })
    if (run === coldRuns - 1) await shot(page, 'cold-start')
    await browser.disconnect?.()
    if (launch) await browser.close()
  }
  const med = (key) => median(runs.map((r) => r[key]))
  report('cold-median', { launchMs: med('launchMs'), firstTileMs: med('firstTileMs'), longestMs: med('longestMs'), totalMs: med('totalMs') })
  manual('compare with the round 1 baseline: overlay visible 8.1 s, longest task 1.28 s; look at cold-start.png for the overlay')
}

async function idle(page) {
  if (!phone) return report('idle', { skipped: 'needs adb gfxinfo' })
  await sleep(IDLE_SETTLE_MS)
  adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'reset')
  await sleep(IDLE_WINDOW_MS)
  const frames = Number(/Total frames rendered: (\d+)/.exec(adb('shell', 'dumpsys', 'gfxinfo', PACKAGE))?.[1] ?? NaN)
  report('idle', { framesIn6s: frames, pass: frames <= 2 })
}

function memory(label) {
  if (!phone) return
  const text = adb('shell', 'dumpsys', 'meminfo', PACKAGE)
  const kb = (name) => Number(new RegExp(`${name}:\\s+(\\d+)`).exec(text)?.[1] ?? NaN)
  report('memory', { label, totalPssKb: Number(/TOTAL(?: PSS)?:\s+(\d+)/.exec(text)?.[1] ?? NaN), graphicsKb: kb('Graphics'), glMtrackKb: Number(/GL mtrack\s+(\d+)/.exec(text)?.[1] ?? NaN), nativeHeapKb: kb('Native Heap') })
}

async function editor(page) {
  // From an empty start, as a new rider would: a saved trip is planned again on launch, which swallows taps for seconds.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('input[data-role="from"]', { visible: true, timeout: TRIP_WAIT_MS })
  await sleep(SETTLE_MS)
  await openField(page, 'from')
  await sleep(900)
  const opened = await state(page)
  report('editor-open', { ...opened, pass: opened.editorOpen && opened.focused === 'from' })
  await shot(page, 'editor-1-open')
  manual('editor-1-open.png: "my location" row and neighbours visible, rows above the keyboard, camera frozen')
  await clearField(page)
  await typeText(page, TRIP.from)
  await sleep(900)
  const typed = await state(page)
  // The list scrolls inside a container that reaches under the keyboard and pads its end by the keyboard's height.
  const lastRowBottom = await page.evaluate(() => {
    const list = document.querySelector('.editor-list')
    list?.scrollTo(0, list.scrollHeight)
    const bottom = document.querySelector('.suggestions li:last-child')?.getBoundingClientRect().bottom
    list?.scrollTo(0, 0)
    return bottom === undefined ? null : Math.round(bottom)
  })
  report('editor-suggestions', { ...typed, lastRowBottom, rowsAboveKeyboard: lastRowBottom !== null && lastRowBottom <= typed.innerHeight + 1 })
  await shot(page, 'editor-2-suggestions')
  await shot(page, 'editor-2b-before-pick')
  await tap(page, '.suggestions li:first-child button')
  await sleep(700)
  if (await page.evaluate((min) => window.innerWidth >= min, SIDE_PANEL_MIN_WIDTH)) return sidePanelTrip(page)
  const moved = await state(page)
  // Headless Chrome has no soft keyboard, so only the phone can say whether it stayed up.
  report('editor-focus-a-to-b', { ...moved, keyboardStillUp: phone ? moved.keyboardInsetPx > 0 : 'n/a', pass: moved.focused === 'to' && (!phone || moved.keyboardInsetPx > 0) })
  await clearField(page)
  await typeText(page, TRIP.to)
  await sleep(900)
  await tap(page, '.suggestions li:first-child button')
  await page.waitForFunction(() => !document.querySelector('.panel--editor'), { timeout: TRIP_WAIT_MS }).catch(() => {})
  await page.waitForSelector('.trip', { timeout: TRIP_WAIT_MS }).catch(() => {})
  const done = await state(page)
  report('editor-trip-complete', { ...done, pass: !done.editorOpen })
  await shot(page, 'editor-3-trip')
  // Back: from the trip view the field opens the editor again, and Android back closes it without leaving the app.
  await tap(page, '.trip button:first-child')
  await sleep(900)
  // With the keyboard up, the first Android back only hides it; the next one reaches the editor.
  await goBack(page)
  await sleep(700)
  const afterFirstBack = await state(page)
  if (afterFirstBack.editorOpen) {
    await goBack(page)
    await sleep(700)
  }
  const afterBack = await state(page)
  const alive = phone ? adb('shell', 'pidof', PACKAGE).trim() !== '' : true
  report('editor-back', { backsNeeded: afterFirstBack.editorOpen ? 2 : 1, keyboardHiddenByFirst: afterFirstBack.keyboardInsetPx === 0, ...afterBack, appStillRunning: alive, pass: !afterBack.editorOpen && alive })
  manual('"Change finish": in the app, long-press the sea (e.g. south of Cádiz) as finish for any start, and check the button on the error')
  manual('fold posture (Z Fold only): open/close the phone with the editor open and with a trip, check nothing stays held at the old width')
}

/** On a wide screen nothing hops from A to B: the rider taps the finish, and the dropdown sits above the keyboard. */
async function sidePanelTrip(page) {
  await tap(page, 'input[data-role="to"]')
  await sleep(500)
  await typeText(page, TRIP.to)
  await sleep(900)
  await shot(page, 'editor-3-side-dropdown')
  await tap(page, '.suggestions li:first-child button')
  await sleep(TRIP_WAIT_MS / 3)
  await shot(page, 'editor-4-side-trip')
  report('editor-side-panel', await state(page))
  manual('editor-3-side-dropdown.png and editor-4-side-trip.png: dropdown above the keyboard, panel and map framed side by side')
}

async function terrain(page) {
  // The ride that was just planned is still being drawn: its tasks must not count as the toggle's.
  await sleep(PLAN_SETTLE_MS)
  memory('before-3d')
  const before = (await longTasks(page)).length
  await tap(page, '.terrain-toggle')
  const started = Date.now()
  await sleep(3500)
  const tasks = (await longTasks(page)).slice(before)
  const longest = Math.max(0, ...tasks.map(([, d]) => d))
  report('terrain-first-toggle', { elapsedMs: Date.now() - started, longTasks: tasks.length, longestMs: longest, pass: longest <= FRAME_BUDGET_MS * 4 })
  await shot(page, 'terrain-3d')
  memory('after-3d')
  await tap(page, '.terrain-toggle')
  await sleep(2500)
  await shot(page, 'terrain-2d-again')
  manual('terrain-3d.png: hillshade still drawn with one DEM source, tilt smooth (watch the phone), no flicker; 2d-again equals the start')
}

if (only.includes('cold')) await cold()
// The steps below work on the app as the cold start left it, or start it when it is not running.
if (phone && !adb('shell', 'pidof', PACKAGE).trim()) {
  adb('shell', 'am', 'start', '-W', '-n', ACTIVITY)
  await sleep(3000)
}
const session = await openPage()
await calibrate(session.page)
if (only.includes('idle')) await idle(session.page)
if (only.includes('idle') || only.includes('terrain')) memory('after-launch')
if (only.includes('editor')) await editor(session.page)
if (only.includes('terrain')) await terrain(session.page)
await session.browser.disconnect?.()
if (launch) await session.browser.close()
process.exit(0)
