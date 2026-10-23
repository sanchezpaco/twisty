// Captures the app for the store assets from a production build served by `vite preview`:
//   cd app && npx vite build && npx vite preview --port 4327 --strictPort     (TWISTY_URL overrides the address)
//   node stores/src/capture.mjs <captures-dir> [shot,shot...]     e.g. ride-es,ride-en; one shot at a time is kinder
//                                                                 to a shared machine: run them in a loop
//   node stores/src/render.mjs <captures-dir> stores/android <sheets-dir>
// The README's shots (desktop and the Z Fold opened, English, no card) come from the same script: their ids start with
// readme-, and each is also written as a JPEG to docs/screenshots/ (macOS `sips` resizes it):
//   node stores/src/capture.mjs <captures-dir> readme-desktop-overview     and so on, one at a time
// Needs Google Chrome (CHROME overrides its path) and the app's node_modules (puppeteer-core, the fonts).
// Debugging: LIST_STOPS=1 prints every slider stop of a trip (and picks none); FAIL_SHOTS_DIR=<dir> keeps a screenshot
// of each failed try; EDGE_DEBUG_DIR=<dir> keeps one per edge check.
// Every image is the real app: towns from the offline index, a slider stop picked by the roads it rides, the camera
// the app framed, moved only the way a rider can (drag, zoom). A plan whose camera stayed at the Spain view is retried
// in a fresh browser; nothing is ever drawn or masked by hand.
import fs from 'node:fs'
import path from 'node:path'
import { cropWindow, CANVAS, CARD } from './crop.mjs'
import { execFileSync } from 'node:child_process'
import { launch, openSession, ready, pickPlace, typeInField, options, tapEl, tapSel, waitPlanned, waitFramed, noteSpainView, mapIdle, settleMap, sleep, PHONE, DESKTOP, FOLD_OPEN, REPO } from './lib.mjs'

const outDir = process.argv[2]
if (!outDir) throw new Error('usage: node capture.mjs <captures-dir> [shot,shot...]')
fs.mkdirSync(outDir, { recursive: true })
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null

const TRIES = 8
/** The card's height in the app's CSS pixels (crop.mjs). */
const CANVAS_HEIGHT_CSS = (CANVAS.height - CARD.top) / (CARD.width / PHONE.width)
/** The feature graphic is cut from a wide window: the app's side-panel layout, with its chrome hidden for the shot. */
const WIDE = { width: 1400, height: 620, deviceScaleFactor: 2 }

const town = (name) => [name, new RegExp(`^${name}( /|$)`)]
const roadsText = (roads) => roads.join(' ; ')

/** Sevilla to Marbella, on the stop that climbs to Grazalema (A-372) and rides on to Ronda and down the A-397. */
const GRAZALEMA = {
  from: town('Sevilla'),
  to: town('Marbella'),
  stop: (roads) => /A-372/.test(roadsText(roads)) && /A-397/.test(roadsText(roads)),
}
/** Llanes to Riaño, on the first stop down the Hermida gorge from Panes to Potes (N-621) and over San Glorio. */
const HERMIDA = {
  from: town('Llanes'),
  to: town('Riaño'),
  stop: (roads) => /Panes/.test(roadsText(roads)) && roads.filter((r) => r.startsWith('N-621')).length >= 2,
}
/**
 * Oviedo to Villablino, on the stop over San Lorenzo (AS-265, from Teverga) and Somiedo (AS-227). From Grau no stop
 * rides San Lorenzo; from Proaza the one that does lists its long chain of roads first.
 */
const SOMIEDO = {
  from: town('Oviedo'),
  to: town('Villablino'),
  stop: (roads) => /AS-265/.test(roadsText(roads)) && /AS-227/.test(roadsText(roads)),
}
/** Granada to Ugíjar, on the stop over La Ragua (A-337). */
const RAGUA = {
  from: town('Granada'),
  to: town('Ugíjar'),
  stop: (roads) => /A-337/.test(roadsText(roads)),
}
/**
 * València to Morella and back: the finish set first on Segorbe only to let a stop be added, then turned into "back to
 * the start". The stop goes inland over the CV-194 and CV-175 to the CV-125, and comes back by Culla's lanes to
 * Benassal (CV-166) and down the CV-15: out one way, home another.
 */
const MAESTRAT = {
  from: town('València'),
  to: town('Segorbe'),
  via: town('Morella'),
  loop: true,
  stop: (roads) => /CV-194/.test(roadsText(roads)) && /CV-166/.test(roadsText(roads)),
}
/** Huesca to Jaca on the slider's last stop, the one with the most curves: up to Arguis and over the Sierra de Guara. */
const GUARA = { from: town('Huesca'), to: town('Jaca'), stop: 'most curves' }
/** Jaca to Benasque, a short trip across the Pyrenees' valleys. */
const BENASQUE = { from: town('Jaca'), to: town('Benasque'), stop: 'most curves' }

/**
 * Phone shots. `sheet`: the snap the shot is taken on; `zoom`: as a rider's pinch, so the ride fits the part of the
 * screen the store card keeps (see crop.mjs), clear of the map's buttons above it and the sheet below.
 */
const PHONE_SHOTS = {
  // Granada to Ugíjar: its two twisties are most of the ride, so the curves fill the card (Sevilla to Marbella, whose
  // motorway run to the hills was most of its line, went under the Open in… list).
  ride: { trip: RAGUA, sheet: 'peek', zoom: { factor: 1.15, centre: [180, 330] } },
  slider: { trip: HERMIDA, sheet: 'half', zoom: { factor: 0.75, centre: [180, 250] } },
  // Names are checked on the whole map at the middle snap; the shot then holds the sheet part way down, by a finger, so
  // a strip of the map shows above the ride's stats and list.
  summary: { trip: SOMIEDO, sheet: 'half', clearCrop: { below: 'controls' }, keep: keepNothing, finish: summaryHeld },
  // The map is placed on the ride's curves and cleared with the sheet down; the list of apps then opens over it.
  openin: { trip: GRAZALEMA, sheet: 'peek', prepare: placeOverGrazalema, keep: keepGrazalema, finish: openInSheet },
  loop: { trip: MAESTRAT, sheet: 'peek', zoom: { factor: 1.5, centre: [180, 320] } },
  spain: { start: true, prepare: spainFillingTheCard, keep: keepPeninsulaAndInset },
  saved: { saved: true },
  // Satellite is chosen on the start screen: switched later, the map's credit grows and the app frames the whole ride
  // again.
  satellite: { trip: HERMIDA, before: toSatellite, prepare: placeOverGorge, keep: keepGorge, labels: 'satellite' },
}
const SHOTS = {
  ...Object.fromEntries(Object.entries(PHONE_SHOTS).flatMap(([id, spec]) => ['es', 'en'].map((lang) => [`${id}-${lang}`, { ...spec, id, lang }]))),
  'fg-route-hermida': { lang: 'es', trip: HERMIDA, viewport: WIDE, bare: true, zoom: { factor: 0.85 } },
  // At 2x the Spain view lost the base map's layers in headless Chrome; at 1x it is whole.
  'fg-spain': { lang: 'es', start: true, viewport: { ...WIDE, deviceScaleFactor: 1 }, bare: true },
}

/**
 * README shots: the whole window as the app framed it, with the side panel (desktop and the Z Fold opened). Each is also
 * written to docs/screenshots/<id>.jpg, no wider than this.
 */
const README_JPEG = { width: 1600, quality: 85 }
const README_SHOTS = {
  'desktop-overview': { start: true, viewport: { ...DESKTOP, deviceScaleFactor: 1 }, prepare: spainBesidePanel },
  'desktop-ride': { trip: GUARA, viewport: DESKTOP },
  'desktop-terrain-3d': { trip: GUARA, viewport: DESKTOP, prepare: terrainOn },
  'desktop-satellite': { trip: BENASQUE, viewport: DESKTOP, before: toSatellite, prepare: placeOverEsera },
  'fold-open-ride': { trip: HERMIDA, viewport: FOLD_OPEN },
}
for (const [id, spec] of Object.entries(README_SHOTS)) SHOTS[`readme-${id}`] = { ...spec, id, lang: 'en', readme: true }

const ASSETS = JSON.parse(fs.readFileSync(new URL('./assets.json', import.meta.url), 'utf8'))
const cropOf = (id) => ASSETS.screenshots.find((s) => s.capture === `${id}-{lang}`).crop

const log = []
const say = (line) => { console.log(line); log.push(line) }

// ---------------------------------------------------------------------------------------------------------- trips

async function setOption(page, index) {
  await page.evaluate((v) => {
    const el = document.querySelector('input[type=range]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, index)
  await sleep(1500)
}

const rideInfo = (page) => page.evaluate(() => ({
  headline: document.querySelector('.headline')?.innerText.replace(/\n/g, ' | ') ?? '',
  roads: [...document.querySelectorAll('.twisties li')].map((li) => li.innerText.replace(/^\d+\s*/, '').replace(/\n/g, ' ')),
}))

/** Walks the slider and stays on the first stop whose roads match, or goes to its last stop ('most curves'). */
async function pickStop(page, matches) {
  const max = await page.evaluate(() => +(document.querySelector('input[type=range]')?.max ?? 0))
  if (matches === 'most curves' && !process.env.LIST_STOPS) {
    await setOption(page, max)
    return { index: max, of: max + 1, ...(await rideInfo(page)) }
  }
  for (let i = 0; i <= max; i++) {
    if (max > 0) await setOption(page, i)
    const info = await rideInfo(page)
    if (process.env.LIST_STOPS) console.log(`  stop ${i + 1}: ${info.headline} | ${info.roads.join(' ; ')}`)
    else if (matches(info.roads)) return { index: i, of: max + 1, ...info }
  }
  throw new Error(`no slider stop rides the named roads`)
}

/** On the phone the trip is a summary until one of its ends is tapped. */
async function openEditor(page, end) {
  // A tap while the sheet still slides to its snap lands beside the button: wait, and tap again if it missed.
  for (let attempt = 0; attempt < 4 && !(await page.$('aside.panel.panel--editor')); attempt++) {
    await sleep(1500)
    const ends = []
    for (const h of await page.$$('.trip > button')) if (!(await h.evaluate((e) => e.classList.contains('trip__stops')))) ends.push(h)
    await tapEl(page, end === 'from' ? ends[0] : ends.at(-1))
    await page.waitForSelector('aside.panel.panel--editor', { timeout: 4000 }).catch(() => {})
  }
  await page.waitForSelector('aside.panel.panel--editor', { timeout: 1000 })
  await sleep(800)
}

async function addStop(page, [query, re]) {
  await openEditor(page, 'from')
  await tapSel(page, '.add-stop button')
  await sleep(800)
  await pickPlace(page, 'via', query, re, 0)
  await waitPlanned(page)
}

/** The finish field offers the start again once the trip has a stop: picking it makes the trip a loop. */
async function finishAtStart(page) {
  await openEditor(page, 'to')
  await tapSel(page, 'input[data-role="to"]')
  await page.waitForSelector('ul.suggestions li[role=option] .label', { timeout: 20000 })
  for (const h of await page.$$('ul.suggestions li[role=option] button')) {
    const detail = await h.evaluate((e) => e.querySelector('.detail')?.textContent?.trim() ?? '')
    if (/Volver al inicio|Back to the start/i.test(detail)) { await tapEl(page, h); break }
  }
  const r = await waitPlanned(page)
  if (!r.ok) throw new Error(`loop failed ${JSON.stringify(r)} ${JSON.stringify(await options(page))}`)
  await page.keyboard.press('Escape')
  await sleep(1200)
}

async function planTrip(page, trip, { framed = true } = {}) {
  await pickPlace(page, 'from', ...trip.from)
  await page.waitForSelector('.place-marker--from', { timeout: 150000 })
  await noteSpainView(page)
  await pickPlace(page, 'to', ...trip.to)
  const r = await waitPlanned(page)
  if (!r.ok) throw new Error(`plan failed ${JSON.stringify(r)}`)
  if (trip.via) await addStop(page, trip.via)
  if (trip.loop) await finishAtStart(page)
  if (framed && !(await waitFramed(page))) throw new Error('camera stayed at the Spain view')
  return pickStop(page, trip.stop)
}

const tripLine = (trip, stop) => `${trip.from[0]} -> ${trip.via ? trip.via[0] + ' -> ' : ''}${trip.loop ? trip.from[0] : trip.to[0]}, stop ${stop.index + 1}/${stop.of}: ${stop.headline} | ${stop.roads.join(' ; ')}`

// ---------------------------------------------------------------------------------------------------------- sheet

/** Drags the sheet's handle down to its lowest snap, the way a rider does. */
async function sheetToPeek(page) {
  const h = await page.waitForSelector('.handle', { visible: true })
  const b = await h.boundingBox()
  const x = b.x + b.width / 2
  let y = b.y + b.height / 2
  await page.touchscreen.touchStart(x, y)
  for (let i = 0; i < 12; i++) { y += 40; await page.touchscreen.touchMove(x, y); await sleep(16) }
  await page.touchscreen.touchEnd()
  await sleep(1500)
}

/** A tap on the handle moves the sheet one snap up, from the middle one to the full sheet. */
async function sheetToFull(page) {
  await tapSel(page, '.handle')
  await sleep(1500)
}

/** Where the parts the render crops around stand on screen, in CSS pixels. */
const boxes = (page) => page.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: b.x, y: b.y, w: b.width, h: b.height } : null }
  const pins = [...document.querySelectorAll('.place-marker')].map((e) => e.getBoundingClientRect()).filter((b) => b.width).map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height }))
  // The saved-rides list down to its last row.
  const savedRows = () => {
    const list = document.querySelector('section.saved')
    const rows = [...document.querySelectorAll('section.saved .row')].map((e) => e.getBoundingClientRect())
    if (!list || rows.length === 0) return null
    const top = list.getBoundingClientRect().top
    return { x: 0, y: top, w: innerWidth, h: Math.max(...rows.map((r) => r.bottom)) - top }
  }
  const sheet = box('aside.panel .head')
  const openSheet = box('div.sheet[aria-labelledby="open-in-title"]')
  const saved = box('section.saved')
  // The map shows down to whatever covers it first; beside a side panel (layout.ts), right of it.
  const side = matchMedia('(min-width: 700px)').matches
  const mapBottom = Math.min(innerHeight, ...[side ? null : sheet, openSheet, saved].filter(Boolean).map((b) => b.y))
  const panel = box('aside.panel')
  const mapLeft = side && panel ? panel.x + panel.w : 0
  return {
    viewport: { w: innerWidth, h: innerHeight }, screen: { x: 0, y: 0, w: innerWidth, h: innerHeight }, mapBottom, mapLeft, pins,
    sheet, openSheet, saved, controls: box('.map-controls'), panel, foot: box('.foot'),
    inset: box('.inset.inset--shown'), twisty2: box('ol.twisties li:nth-child(2)'), savedList: savedRows(),
    trip: box('.trip'), headline: box('.headline'), slider: box('.slider .bars'), ends: box('.slider .ends'), twisties: box('ol.twisties'),
    from: box('.place-marker--from .place-marker__dot'), to: box('.place-marker--to .place-marker__dot'),
  }
})

async function save(page, file, measured) {
  if (!(await settleMap(page))) console.log(`${path.basename(file)}: the map was still changing when shot`)
  await page.screenshot({ path: file })
  fs.writeFileSync(file.replace(/\.png$/, '.json'), JSON.stringify(measured ?? (await boxes(page)), null, 1))
}

// ---------------------------------------------------------------------------------------------------------- camera

/** The white dots the map draws for a trip's stops (layers.ts: a white circle with a dark ring), found in the pixels. */
function stopDotsInPixels({ data, width, dpr }, { top, bottom, skip }) {
  const cssW = Math.round(width / dpr)
  const cssH = Math.round(bottom)
  const white = new Uint8Array(cssW * cssH)
  for (let cy = Math.round(top); cy < cssH; cy++) {
    for (let cx = 0; cx < cssW; cx++) {
      if (skip.some((b) => cx >= b.x - 4 && cx <= b.x + b.w + 4 && cy >= b.y - 4 && cy <= b.y + b.h + 4)) continue
      const i = (Math.round((cy + 0.5) * dpr) * width + Math.round((cx + 0.5) * dpr)) * 4
      if (Math.min(data[i], data[i + 1], data[i + 2]) >= 250) white[cy * cssW + cx] = 1
    }
  }
  const dots = []
  for (let start = 0; start < white.length; start++) {
    if (!white[start]) continue
    const queue = [start]
    white[start] = 0
    let n = 0, sx = 0, sy = 0
    while (queue.length) {
      const k = queue.pop()
      const x = k % cssW, y = (k - x) / cssW
      n++; sx += x; sy += y
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy
        if (xx >= 0 && xx < cssW && yy >= 0 && yy < cssH && white[yy * cssW + xx]) { white[yy * cssW + xx] = 0; queue.push(yy * cssW + xx) }
      }
    }
    // A stop's dot is about 10 px across; specks and big white shapes are something else.
    if (n >= 40 && n <= 140) dots.push([sx / n, sy / n])
  }
  return dots
}

/**
 * The centres of the trip's pins: start and finish (page elements) and, on a trip with stops, the stops (dots drawn on
 * the map, looked for below the map's buttons).
 */
async function pinCentres(page) {
  const b = await boxes(page)
  const pins = b.pins.map((p) => [p.x + p.w / 2, p.y + p.h / 2])
  if (!(await page.$('.trip__stops'))) return pins
  const top = b.controls.y + b.controls.h
  const dots = await withScreenPixels(page, stopDotsInPixels, { top, bottom: b.mapBottom, skip: b.pins })
  return [...pins, ...dots]
}

/** How far apart the two pins furthest from each other stand. */
const pinSpan = (pins) => Math.max(0, ...pins.flatMap((a) => pins.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]))))

/**
 * Zooms the map with the wheel about `pointer` until `measure()` (a length on screen) is `factor` times what it was.
 * A zoom about a point P maps y to P + (y - P) * factor, so a pointer at (centre - mid * factor) / (1 - factor) lands
 * the middle `mid` at `centre`.
 */
async function zoomBy(page, { factor, pointer, measure, strict = true }) {
  const start = await measure()
  const target = start * factor
  const reached = (now) => (factor > 1 ? now >= target : now <= target)
  await page.mouse.move(...pointer)
  let now = start
  // A wheel step's size sets how far MapLibre zooms: big steps while far from the target, small ones near it.
  for (let i = 0; i < 80 && !reached(now); i++) {
    const delta = Math.min(600, Math.max(6, 150 * Math.abs(Math.log2(target / now))))
    await page.mouse.wheel({ deltaY: factor > 1 ? -delta : delta })
    await sleep(400)
    now = await measure()
    if (process.env.ZOOM_DEBUG) console.log(`    wheel ${delta.toFixed(0)} at ${pointer.map(Math.round)} -> ${Math.round(now)}`)
  }
  console.log(`  zoom: ${Math.round(start)} -> ${Math.round(now)} px (asked x${factor.toFixed(3)})`)
  if (strict && !reached(now * (factor > 1 ? 1.05 : 0.95))) throw new Error('the map did not zoom')
}

/** Zooms on the ride, as a rider's pinch would, its middle landing at `centre` (or staying where it is). */
async function zoomOnRide(page, { factor, centre }) {
  const pins = await pinCentres(page)
  const xs = pins.map((p) => p[0])
  const ys = pins.map((p) => p[1])
  const mid = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  if (Math.abs(factor - 1) < 0.01) {
    if (centre) await panMap(page, centre[0] - mid[0], centre[1] - mid[1])
    return
  }
  const pointer = centre ? [0, 1].map((i) => (centre[i] - mid[i] * factor) / (1 - factor)) : mid
  const b = await boxes(page)
  // On the map itself: not under the sheet, nor on the buttons over the map's top.
  const onMap = pointer[0] > b.mapLeft && pointer[0] < b.viewport.w && pointer[1] > b.controls.y + b.controls.h && pointer[1] < b.mapBottom
  const measure = async () => pinSpan(await pinCentres(page))
  if (onMap) {
    try {
      return await zoomBy(page, { factor, pointer, measure })
    } catch (e) {
      // Some spots over the map do not take the wheel (the map's foot, say): fall back to the ride's middle below.
      console.log(`  zoom about ${pointer.map(Math.round)} failed (${e.message}), about the ride's middle instead`)
    }
  }
  // The point to zoom about lies off the map, or did not zoom: zoom about the ride's middle, then drag it into place.
  await zoomBy(page, { factor, pointer: mid, measure })
  await sleep(800)
  await zoomOnRide(page, { factor: 1, centre })
}

/**
 * Drags the map by (dx, dy) CSS px, holding still before letting go so it does not glide on. A mouse drag: puppeteer's
 * touch moves did not reach the map, which then took the press for a long one and opened its pick menu.
 */
async function panMap(page, dx, dy) {
  const b = await boxes(page)
  const x = Math.min(b.viewport.w - 10, Math.max(b.mapLeft + 10, (b.mapLeft + b.viewport.w) / 2 - dx / 2))
  const y = Math.min(b.mapBottom - 40, Math.max(140, b.mapBottom - 70 - Math.max(0, dy)))
  const STEPS = 10
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + (dx * i) / STEPS, y + (dy * i) / STEPS); await sleep(30) }
  await sleep(300)
  await page.mouse.up()
  if (await page.$('.pick-menu')) throw new Error('the pan opened the pick menu')
}

// ---------------------------------------------------------------------------------------------------------- pixels

/** Reads the current screen into a canvas in the page, for the pixel checks below (the app is not touched). */
async function withScreenPixels(page, fn, arg) {
  const png = await page.screenshot({ encoding: 'base64' })
  return page.evaluate(async (png, fnSource, arg) => {
    const img = new Image()
    img.src = `data:image/png;base64,${png}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const g = canvas.getContext('2d')
    g.drawImage(img, 0, 0)
    const data = g.getImageData(0, 0, img.width, img.height).data
    const dpr = img.width / innerWidth
    return new Function('return ' + fnSource)()({ data, width: img.width, height: img.height, dpr }, arg)
  }, png, fn.toString(), arg)
}

/**
 * Place names in the dark style are light and nearly grey (MAP_COLORS.label, labelStrong); the overlay's twisties are
 * saturated, roads and hillshade darker or bluer. On satellite they are white with a dark halo, over a photo that can
 * be as bright: a name's pixel there is near white with a dark one beside it.
 */
const LABEL_LOOKS = {
  dark: { light: 110, chroma: 36, minPixels: 10 },
  // Fewer pixels: a name half under the map's credit shows only a sliver at the edge.
  satellite: { white: 225, halo: 90, haloPx: 2, minPixels: 4 },
}
const EDGE_STRIP_PX = 6
/** Columns without label pixels that end a name when measuring how far it reaches in from an edge. */
const LABEL_GAP_PX = 8
/** Rows above and below an edge hit still read as the same line of text. */
const LABEL_BAND_PX = 4

/** Label pixels along the card's left, right and top edges, and how far in (CSS px) the names crossing the sides reach. */
function edgeLabelsInPixels({ data, width, dpr }, { top, bottom, look, k }) {
  const y0 = Math.round(top * dpr)
  const y1 = Math.round(bottom * dpr)
  const at = (x, y) => (y * width + x) * 4
  const isLabel = (x, y) => {
    const i = at(x, y)
    const max = Math.max(data[i], data[i + 1], data[i + 2])
    const min = Math.min(data[i], data[i + 1], data[i + 2])
    if (look.light) return max >= look.light && max - min <= look.chroma
    if (min < look.white) return false
    for (let d = -look.haloPx; d <= look.haloPx; d++) {
      for (const [xx, yy] of [[x + d, y], [x, y + d]]) {
        if (xx < 0 || xx >= width || yy < 0) continue
        const j = at(xx, yy)
        if (Math.max(data[j], data[j + 1], data[j + 2]) <= look.halo) return true
      }
    }
    return false
  }
  const strip = Math.round(k.strip * dpr)
  const rowsAtEdge = (xs) => {
    const hit = new Set()
    for (let y = y0; y < y1; y++) if (xs.some((x) => isLabel(x, y))) for (let d = -k.band * dpr; d <= k.band * dpr; d++) hit.add(y + d)
    return [...hit].filter((y) => y >= y0 && y < y1)
  }
  const cssWidth = Math.round(width / dpr)
  const reach = (rows, fromRight) => {
    let last = 0
    for (let i = 0, gap = 0; i < cssWidth && gap < k.gap; i++) {
      const cx = fromRight ? cssWidth - 1 - i : i
      let any = false
      for (let x = Math.round(cx * dpr); x < Math.round((cx + 1) * dpr) && !any; x++) any = rows.some((y) => isLabel(x, y))
      if (any) { last = i + 1; gap = 0 } else gap++
    }
    return last
  }
  // Where the route itself runs off an edge, its white casing reads like a name on a photo: rows near a twisty's
  // colour at the edge are left out of the count.
  const isRoute = (x, y) => {
    const i = at(x, y)
    const max = Math.max(data[i], data[i + 1], data[i + 2])
    return max >= 150 && max - Math.min(data[i], data[i + 1], data[i + 2]) >= 90
  }
  const reachPx = Math.round(k.routeNear * dpr)
  const nearRoute = (y, fromRight) => {
    for (let yy = Math.max(y0, y - reachPx); yy < Math.min(y1, y + reachPx); yy++) {
      for (let d = 0; d < strip + reachPx; d++) if (isRoute(fromRight ? width - 1 - d : d, yy)) return true
    }
    return false
  }
  let left = 0
  let right = 0
  for (let y = y0; y < y1; y++) {
    let l = 0
    let r = 0
    for (let x = 0; x < strip; x++) { if (isLabel(x, y)) l++; if (isLabel(width - 1 - x, y)) r++ }
    if (l && !(look.white && nearRoute(y, false))) left += l
    if (r && !(look.white && nearRoute(y, true))) right += r
  }
  let upper = 0
  for (let x = 0; x < width; x++) {
    let n = 0
    for (let y = y0; y < y0 + Math.round((k.strip / 2) * dpr); y++) if (isLabel(x, y)) n++
    if (n && look.white) {
      // The same for the route running off the top edge.
      let route = false
      for (let xx = Math.max(0, x - reachPx); xx < Math.min(width, x + reachPx) && !route; xx++) for (let yy = y0; yy < y0 + reachPx && !route; yy++) route = isRoute(xx, yy)
      if (route) n = 0
    }
    upper += n
  }
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i)
  return {
    left, right, top: upper,
    leftReach: left >= k.min ? reach(rowsAtEdge(range(0, strip)), false) : 0,
    rightReach: right >= k.min ? reach(rowsAtEdge(range(width - strip, width)), true) : 0,
  }
}

/** Room kept between the trip's pins and the card's edges, and past a name pushed off the card. */
const PINS_MARGIN_PX = 24
const PUSH_MARGIN_PX = 6
/** A name shows less than this across an edge; a longer reach is the route or a pin in the same rows, not a name. */
const MAX_PUSH_PX = 110

/** What the card would cut: names across its left, right and top edges, and trip pins outside it. */
async function cutsAtEdges(page, crop, keep, labels = 'dark') {
  const b = await boxes(page)
  const { top } = cropWindow(b, crop)
  const bottom = b.mapBottom
  if (bottom - top < 20) return { clean: true, noMap: true }
  const px = await withScreenPixels(page, edgeLabelsInPixels, {
    top, bottom, look: LABEL_LOOKS[labels],
    k: { strip: EDGE_STRIP_PX, gap: LABEL_GAP_PX, band: LABEL_BAND_PX, min: LABEL_LOOKS[labels].minPixels, routeNear: 8 },
  })
  const w = b.viewport.w
  const { points, margin } = keep ? await keep(page) : { points: [], margin: 0 }
  const out = points.filter(([x, y]) => x < margin || x > w - margin || y < top + margin || y > bottom - margin).length
  const min = LABEL_LOOKS[labels].minPixels
  const cut = { left: px.left >= min, right: px.right >= min, top: px.top >= min, out }
  if (process.env.EDGE_DEBUG_DIR) await page.screenshot({ path: path.join(process.env.EDGE_DEBUG_DIR, `edge-${Date.now()}.png`) })
  return { ...cut, leftReach: px.leftReach, rightReach: px.rightReach, clean: !cut.left && !cut.right && !cut.top && out === 0 }
}

/**
 * What must stay on the card while names are pushed off its edges. A trip: its pins, clear of the edges. The Spain view:
 * the peninsula's twisties. The satellite view: the gorge and the pass, which may run a little past the card.
 */
const keepPins = async (page) => ({ points: await pinCentres(page), margin: PINS_MARGIN_PX + 12 })
async function keepPeninsulaAndInset(page) {
  const b = await boxes(page)
  const o = await withScreenPixels(page, overlayBoxInPixels, { top: b.controls.y + b.controls.h + 2, bottom: b.mapBottom })
  const i = b.inset
  if (!i) return { points: [[-1, -1]], margin: 0 }
  return { points: [[o.x0, o.y0], [o.x1, o.y1], [i.x, i.y], [i.x + i.w, i.y + i.h]], margin: 4 }
}
async function keepGorge(page) {
  // Out with the orthophoto, out of the card: a zoom that drops back to Sentinel does not count.
  if (!/PNOA/.test(await imageryCredit(page))) return { points: [[-1, -1]], margin: 0 }
  const at = await placesOnScreen(page, ENDS.hermida)
  return { points: [at(GORGE.west, GORGE.north), at(GORGE.east, GORGE.south)], margin: -40 }
}
async function keepNothing() {
  return { points: [], margin: 0 }
}
async function keepGrazalema(page) {
  const at = await placesOnScreen(page, ENDS.grazalema)
  return { points: [at(GRAZALEMA_CURVES.west, GRAZALEMA_CURVES.north), at(GRAZALEMA_CURVES.east, GRAZALEMA_CURVES.south)], margin: 0 }
}

/**
 * Zooms tried in turn, relative to the first, when pushing names off keeps cutting others or pushes the trip out: a
 * slightly different zoom shows other names in other places.
 */
const ZOOMS = [1, 0.96, 1.04, 0.92, 1.08, 0.88, 1.12]
const MOVES_PER_ZOOM = 4
/** A small step up or down when a name lies across the card's top edge. */
const NUDGE_Y_PX = 10

/**
 * Moves the map, as a rider would, until no place name runs across an edge of the store card and the trip's pins are
 * inside it: a name cut on one side is pushed off that side, just past its end. The names are the app's own: the map
 * is only panned and zoomed, nothing is painted over or hidden.
 */
async function clearEdges(page, crop, zoomAbout, keep, labels) {
  const history = []
  let zoomedTo = 1
  for (const nudge of ZOOMS) {
    if (nudge !== zoomedTo) { await zoomAbout(nudge / zoomedTo); zoomedTo = nudge; await sleep(1500) }
    let moved = [0, 0]
    const seen = new Set()
    for (let move = 0; move <= MOVES_PER_ZOOM; move++) {
      await settleMap(page, { gapMs: 1500, equalFrames: 2 })
      const cut = await cutsAtEdges(page, crop, keep, labels)
      history.push(cut.clean)
      console.log(`  zoom x${nudge} moved ${JSON.stringify(moved)}: ${JSON.stringify(cut)}`)
      if (cut.clean) return { ok: true, zoom: nudge, moved, tries: history.length }
      // What the shot is about left the card: undo this zoom's moves and try another zoom.
      if (cut.out) { if (moved[0] || moved[1]) await panMap(page, -moved[0], -moved[1]); break }
      let dx = 0
      let dy = 0
      // With names cut on both sides, the one that shows less is pushed off: the other comes further in.
      const pushLeft = cut.left && (!cut.right || cut.leftReach <= cut.rightReach)
      if (cut.left || cut.right) {
        const reach = pushLeft ? cut.leftReach : cut.rightReach
        if (reach > MAX_PUSH_PX) break
        dx = pushLeft ? -(reach + PUSH_MARGIN_PX) : reach + PUSH_MARGIN_PX
      } else dy = move % 2 ? NUDGE_Y_PX : -NUDGE_Y_PX
      const next = [moved[0] + dx, moved[1] + dy]
      // Pushing back and forth between two names: this zoom has no clean place.
      const key = next.map((v) => Math.round(v / 4)).join()
      if (seen.has(key)) break
      seen.add(key)
      await panMap(page, dx, dy)
      moved = next
      await sleep(800)
    }
  }
  return { ok: false, tries: history.length }
}

// ---------------------------------------------------------------------------------------------------------- scenes

/** Scrolls the full sheet, as a thumb would, until the ride's stats sit under the handle and its twisties follow. */
async function scrollToTwisties(page) {
  await page.evaluate(() => {
    const body = document.querySelector('aside.panel .body')
    const mix = document.querySelector('aside.panel .mix')
    const head = document.querySelector('aside.panel .head')
    body.scrollTop += mix.getBoundingClientRect().top - head.getBoundingClientRect().bottom - 8
  })
  await sleep(1200)
}

/**
 * The full sheet, scrolled to the ride's stats, then held part way down by a finger: the sheet follows it, the list
 * stays scrolled, and a strip of the map with the ride shows above. The finger is not lifted before the shot.
 */
async function summaryHeld(page) {
  await sheetToFull(page)
  await scrollToTwisties(page)
  const h = await page.waitForSelector('.handle', { visible: true })
  const b = await h.boundingBox()
  const x = b.x + b.width / 2
  let y = b.y + b.height / 2
  // The card ends under the list's second road; the sheet stops where that leaves the card starting just under the
  // map's buttons, so the strip of map is as tall as it can be.
  const bx = await boxes(page)
  const head = bx.sheet.y
  const secondRoadBottom = bx.twisty2.y + bx.twisty2.h - head
  const cardTop = bx.controls.y + bx.controls.h + 12
  const sheetTop = cardTop + CANVAS_HEIGHT_CSS - secondRoadBottom - cropOf('summary').pad
  await page.touchscreen.touchStart(x, y)
  const steps = 16
  const dy = (sheetTop - head) / steps
  for (let i = 0; i < steps; i++) { y += dy; await page.touchscreen.touchMove(x, y); await sleep(30) }
  await sleep(1500)
}

/** The ride's "Open in…" button, on a first launch, opens the list of apps to hand the ride to. */
async function openInSheet(page) {
  await tapSel(page, '.line .cta')
  await page.waitForSelector('div.sheet[aria-labelledby="open-in-title"]', { visible: true, timeout: 10000 })
  await sleep(1500)
}

/**
 * Where the twisty overlay is drawn: the box of its largest patch (the peninsula, once the overlay's saturated colours
 * are joined across the gaps between roads), so islands far off do not stretch it.
 */
function overlayBoxInPixels({ data, width, dpr }, { top, bottom }) {
  const CELL = 4
  // Joins patches up to about 40 px apart, so the peninsula stays one patch at every zoom (its plateau's twisties are
  // sparse); the Canaries lie further off.
  const JOIN = 10
  const cols = Math.ceil(width / dpr / CELL)
  const rows = Math.ceil((bottom - top) / CELL)
  const on = new Uint8Array(cols * rows)
  for (let y = Math.round(top * dpr); y < Math.round(bottom * dpr); y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const max = Math.max(data[i], data[i + 1], data[i + 2])
      if (max >= 140 && max - Math.min(data[i], data[i + 1], data[i + 2]) >= 90) on[Math.floor((y / dpr - top) / CELL) * cols + Math.floor(x / dpr / CELL)] = 1
    }
  }
  const seen = new Uint8Array(cols * rows)
  let best = null
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || seen[start]) continue
    const queue = [start]
    seen[start] = 1
    const box = { n: 0, c0: Infinity, c1: -Infinity, r0: Infinity, r1: -Infinity }
    while (queue.length) {
      const k = queue.pop()
      const c = k % cols, r = (k - c) / cols
      box.n++
      box.c0 = Math.min(box.c0, c); box.c1 = Math.max(box.c1, c); box.r0 = Math.min(box.r0, r); box.r1 = Math.max(box.r1, r)
      for (let dr = -JOIN; dr <= JOIN; dr++) for (let dc = -JOIN; dc <= JOIN; dc++) {
        const cc = c + dc, rr = r + dr
        if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) continue
        const kk = rr * cols + cc
        if (on[kk] && !seen[kk]) { seen[kk] = 1; queue.push(kk) }
      }
    }
    if (!best || box.n > best.n) best = box
  }
  if (!best) return { x0: 0, x1: 0, y0: 0, y1: 0 }
  return { x0: best.c0 * CELL, x1: (best.c1 + 1) * CELL, y0: top + best.r0 * CELL, y1: top + (best.r1 + 1) * CELL }
}

const mercY = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI

/**
 * The start screen at the app's own Spain view, the sheet down to its fields: the overlay across the peninsula and
 * the box the app draws for the Canary Islands at the map's foot.
 */
async function startSpainView(page) {
  // The start screen shows the road network loading at first; the shot waits until it has gone.
  await page.waitForFunction(() => !document.querySelector('.engine'), { timeout: 180000 })
  await sheetToPeek(page)
  await page.waitForSelector('.inset.inset--shown', { visible: true, timeout: 30000 })
  // The base map's tiles this far out are large, and a busy machine parses them long after they arrive, without
  // drawing anything new meanwhile: an unchanged screen is no proof here, only time is.
  await mapIdle(page, LOW_ZOOM_TILES_MS)
}
const LOW_ZOOM_TILES_MS = 75000

/** The start screen at the app's own Spain view beside the panel, with the box for the Canary Islands. */
async function spainBesidePanel(page) {
  await page.waitForSelector('.inset.inset--shown', { visible: true, timeout: 30000 })
  const b = await boxes(page)
  await waitForBaseMap(page, { left: b.mapLeft, top: b.controls.y + b.controls.h, bottom: b.viewport.h - FOOT_PX })
}
/** The map's foot, where the credit's grey text would count as names. */
const FOOT_PX = 48

/**
 * Headless Chrome sometimes never paints the base map's tiles at the Spain view, only the hillshade and the overlay: the
 * names of its towns are looked for in `area` (CSS px), and without them the try is started again. A base map painted
 * only in part still passes: check the shot.
 */
async function waitForBaseMap(page, area) {
  for (let waited = 0; ; waited += BASE_MAP_POLL_MS) {
    await mapIdle(page, BASE_MAP_POLL_MS)
    const share = await withScreenPixels(page, nameShare, area)
    console.log(`  base map: names on ${(share * 100).toFixed(2)}% of the map`)
    if (share >= MIN_NAME_SHARE) return
    if (waited >= LOW_ZOOM_TILES_MS) throw new Error(`the base map was not painted (names on ${(share * 100).toFixed(2)}%)`)
  }
}
const BASE_MAP_POLL_MS = 15000
/** Names cover about 0.7% of the desktop Spain view; the hillshade and the overlay alone, next to nothing. */
const MIN_NAME_SHARE = 0.002

/** The share of `area` (CSS px, right of `left`) in the dark style's light grey names (LABEL_LOOKS.dark). */
function nameShare({ data, width, dpr }, { left, top, bottom }) {
  let n = 0
  let all = 0
  for (let y = Math.round(top * dpr); y < Math.round(bottom * dpr); y++) {
    for (let x = Math.round(left * dpr); x < width; x++) {
      const i = (y * width + x) * 4
      const max = Math.max(data[i], data[i + 1], data[i + 2])
      if (max >= 110 && max - Math.min(data[i], data[i + 1], data[i + 2]) <= 36) n++
      all++
    }
  }
  return n / all
}

/**
 * The Spain view, then the rider's pinch until the peninsula's twisties fill the card's width, short of the zoom where
 * the app takes the Canarias box away, and a drag that sets it over the box. `width` (px) makes the English shot match
 * the Spanish one.
 */
async function spainFillingTheCard(page, width) {
  await startSpainView(page)
  const b = await boxes(page)
  const { top } = cropWindow(b, cropOf('spain'))
  const mapTop = b.controls.y + b.controls.h + 2
  const measure = () => withScreenPixels(page, overlayBoxInPixels, { top: mapTop, bottom: b.mapBottom })
  const target = width ?? b.viewport.w - 2 * SPAIN_SIDE_PX
  let now = await measure()
  await page.mouse.move((now.x0 + now.x1) / 2, (now.y0 + now.y1) / 2)
  for (let i = 0; i < 40 && now.x1 - now.x0 < target; i++) {
    const delta = Math.min(120, Math.max(6, 150 * Math.log2(target / (now.x1 - now.x0))))
    await page.mouse.wheel({ deltaY: -delta })
    await sleep(500)
    if (!(await page.$('.inset.inset--shown'))) {
      // One step too far: the box went. Back out until it is there again.
      for (let j = 0; j < 10 && !(await page.$('.inset.inset--shown')); j++) { await page.mouse.wheel({ deltaY: 12 }); await sleep(600) }
      break
    }
    now = await measure()
  }
  await sleep(1000)
  now = await measure()
  const inset = (await boxes(page)).inset
  const want = [(b.viewport.w) / 2, (top + 16 + inset.y - 12) / 2]
  await panMap(page, want[0] - (now.x0 + now.x1) / 2, want[1] - (now.y0 + now.y1) / 2)
  await mapIdle(page, LOW_ZOOM_TILES_MS)
  await waitForBaseMap(page, { left: 0, top: mapTop, bottom: (await boxes(page)).inset.y })
  now = await measure()
  console.log(`  spain: peninsula ${Math.round(now.x1 - now.x0)} px wide (asked ${Math.round(target)})`)
  return { width: now.x1 - now.x0 }
}
// Room at the sides for the names on the coasts (Vigo, Lisboa) and the Balearics.
const SPAIN_SIDE_PX = 54

/** Where the map shows the trip's start and finish (their pins are placed even when off screen). */
const endPins = (page) => page.evaluate(() => ['from', 'to'].map((k) => {
  const r = document.querySelector(`.place-marker--${k} .place-marker__dot`).getBoundingClientRect()
  return [r.x + r.width / 2, r.y + r.height / 2]
}))

/** Two towns of a trip as the offline index places them (where its pins stand), as [lon, lat]. */
const ENDS = {
  hermida: [[-4.7531, 43.4211], [-5.0057, 42.9756]],
  grazalema: [[-5.9953, 37.3886], [-4.8856, 36.509]],
  benasque: [[-0.5494, 42.5693], [0.5237, 42.6053]],
}
/** The Hermida gorge from Panes down past La Hermida, close enough for the orthophoto (PNOA) to show it. */
const GORGE = { west: -4.625, east: -4.58, south: 43.235, north: 43.315 }
/** The curves of Sevilla to Marbella: Grazalema, Ronda and the A-397 down to San Pedro, with the finish at Marbella. */
const GRAZALEMA_CURVES = { west: -5.47, east: -4.84, south: 36.49, north: 36.8 }
/** The Ésera valley from the Ventamillo gorge up to Benasque, the last miles of Jaca to Benasque. */
const ESERA = { west: 0.44, east: 0.56, south: 42.47, north: 42.62 }

/** Where a place of a trip's map lands on screen, worked out from the trip's two pins (north-up Web Mercator). */
async function placesOnScreen(page, ends) {
  const [pa, pb] = await endPins(page)
  if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < 40) throw new Error('the trip pins are not where the ride is')
  const [[lonA, latA], [lonB, latB]] = ends
  // From the distance between the pins: two towns at nearly the same latitude say nothing about the scale up and down.
  const k = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / Math.hypot(lonB - lonA, mercY(latB) - mercY(latA))
  return (lon, lat) => [pa[0] + (lon - lonA) * k, pa[1] - (mercY(lat) - mercY(latA)) * k]
}

/** A rider's drag and pinch until `region` fills `area` (CSS px), measured by the trip's two pins. */
async function frameRegion(page, ends, region, area) {
  const at = await placesOnScreen(page, ends)
  const [x0, y0] = at(region.west, region.north)
  const [x1, y1] = at(region.east, region.south)
  const factor = Math.min((area.right - area.left) / (x1 - x0), (area.bottom - area.top) / (y1 - y0))
  const mid = [(x0 + x1) / 2, (y0 + y1) / 2]
  const centre = [(area.left + area.right) / 2, (area.top + area.bottom) / 2]
  const span = async () => { const [a2, b2] = await endPins(page); return Math.hypot(a2[0] - b2[0], a2[1] - b2[1]) }
  await panMap(page, centre[0] - mid[0], centre[1] - mid[1])
  await sleep(1000)
  await zoomBy(page, { factor, pointer: centre, measure: span, strict: false })
  return centre
}

const imageryCredit = (page) => page.evaluate(() => document.querySelector('.foot__imagery')?.textContent ?? '')

/** The gorge, then in a little more until the app shows the PNOA orthophoto (its credit says so). */
async function placeOverGorge(page) {
  await sheetToPeek(page)
  const b = await boxes(page)
  const { top } = cropWindow(b, cropOf('satellite'))
  const centre = await frameRegion(page, ENDS.hermida, GORGE, { top: top + 16, bottom: b.mapBottom - 40, left: 16, right: b.viewport.w - 16 })
  await inToOrthophoto(page, centre)
}

/** The Ésera valley beside the side panel, on the orthophoto. */
async function placeOverEsera(page) {
  const b = await boxes(page)
  const centre = await frameRegion(page, ENDS.benasque, ESERA, { top: b.controls.y + b.controls.h + 24, bottom: b.mapBottom - 40, left: b.mapLeft + 24, right: b.viewport.w - 24 })
  await inToOrthophoto(page, centre)
}

/** In a little more about `centre` until the app shows the PNOA orthophoto (its credit says so). */
async function inToOrthophoto(page, centre) {
  await page.mouse.move(...centre)
  for (let i = 0; i < 30 && !/PNOA/.test(await imageryCredit(page)); i++) { await page.mouse.wheel({ deltaY: -40 }); await sleep(500) }
  if (!/PNOA/.test(await imageryCredit(page))) throw new Error('the orthophoto never came in')
  // The photo's tiles and the names' glyphs come last.
  await mapIdle(page, 15000)
}

/** Sevilla to Marbella's curves in the part of the map the Open in… list leaves in the card. */
async function placeOverGrazalema(page) {
  const b = await boxes(page)
  const { top } = cropWindow(b, cropOf('openin'))
  await frameRegion(page, ENDS.grazalema, GRAZALEMA_CURVES, { top: top + 24, bottom: OPEN_IN_TOP_PX - 24, left: 24, right: b.viewport.w - 24 })
  await mapIdle(page, 4000)
}
/** Where the Open in… list's top stands on the phone (it opens after the map is placed). */
const OPEN_IN_TOP_PX = 492

/** The 3D switch over the map: the camera tilts over the ride. */
async function terrainOn(page) {
  await tapSel(page, '.terrain-toggle')
  await sleep(3000)
  await mapIdle(page, 5000)
}

/** The map style picker, on satellite. */
async function toSatellite(page) {
  await tapSel(page, '.picker .layers')
  await sleep(800)
  const tiles = await page.$$('.picker .tile')
  await tapEl(page, tiles[2])
  await sleep(800)
  await tapSel(page, '.picker .layers')
  await mapIdle(page, 4000)
}

/**
 * Rides saved for the saved-rides shot, into two folders, in the order they are planned, each on its own day: the
 * browser's clock is set back that many days before the save, the way a rider saves rides over some weeks.
 */
const SAVES = [
  { trip: GRAZALEMA, daysAgo: 26, folder: { es: 'Pendientes', en: 'To ride' } },
  { trip: HERMIDA, daysAgo: 19, folder: { es: 'Picos de Europa', en: 'Picos de Europa' } },
  { trip: SOMIEDO, daysAgo: 12, folder: { es: 'Pendientes', en: 'To ride' } },
  { trip: RAGUA, daysAgo: 4, folder: { es: 'Pendientes', en: 'To ride' } },
  { trip: MAESTRAT, daysAgo: 0, folder: { es: 'Pendientes', en: 'To ride' } },
]
const CLOCK_KEY = 'store-capture.days-ago'

/** A browser clock set back by the days in sessionStorage, from the page's first script on. */
function clockSetBack(key) {
  const days = Number(sessionStorage.getItem(key) ?? 0)
  if (!days) return
  const shift = days * 86400000
  const RealDate = Date
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() - shift)
      else super(...args)
    }
    static now() {
      return RealDate.now() - shift
    }
  }
  globalThis.Date = ShiftedDate
}
const OPEN_FOLDER = { es: 'Pendientes', en: 'To ride' }

async function saveRide(page, folderName) {
  await tapSel(page, '.line .save')
  const sheet = 'div.sheet[aria-labelledby="save-ride-title"]'
  await page.waitForSelector(sheet, { visible: true })
  await sleep(600)
  let chip = null
  for (const h of await page.$$(`${sheet} .chip`)) if ((await h.evaluate((e) => e.textContent.trim())) === folderName) chip = h
  if (chip) await tapEl(page, chip)
  else {
    await tapSel(page, `${sheet} .chip--new`)
    await sleep(400)
    await page.keyboard.type(folderName, { delay: 40 })
  }
  await tapSel(page, `${sheet} button.save`)
  await sleep(1500)
}

/** Plans each ride in one profile and saves it, then shows a folder of the saved rides on a fresh start. */
async function savedScene(page, lang) {
  const saved = []
  await page.evaluateOnNewDocument(clockSetBack, CLOCK_KEY)
  const setClock = (days) => page.evaluate((key, d) => sessionStorage.setItem(key, String(d)), CLOCK_KEY, days)
  for (const { trip, folder, daysAgo } of SAVES) {
    await setClock(daysAgo)
    await page.evaluate(() => localStorage.removeItem('twisty.trip'))
    await page.goto(page.url(), { waitUntil: 'domcontentloaded' })
    await ready(page)
    const stop = await planTrip(page, trip, { framed: false })
    await saveRide(page, folder[lang])
    saved.push(tripLine(trip, stop) + ` -> ${folder[lang]}, ${daysAgo} days ago`)
  }
  await setClock(0)
  await page.evaluate(() => localStorage.removeItem('twisty.trip'))
  await page.goto(page.url(), { waitUntil: 'domcontentloaded' })
  await ready(page)
  await tapSel(page, '.saved-entry')
  await page.waitForSelector('section.saved', { visible: true })
  await sleep(1000)
  for (const h of await page.$$('section.saved .row')) if ((await h.evaluate((e) => e.querySelector('.name')?.textContent.trim())) === OPEN_FOLDER[lang]) { await tapEl(page, h); break }
  await sleep(2000)
  return saved
}

// ---------------------------------------------------------------------------------------------------------- shots

/** The README's copy of a shot: a JPEG in docs/screenshots, no wider than README_JPEG.width (a PNG's width is at byte 16). */
function writeReadmeJpeg(png, id) {
  const width = Math.min(README_JPEG.width, fs.readFileSync(png).readUInt32BE(16))
  const out = path.join(REPO, 'docs/screenshots', `${id}.jpg`)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(README_JPEG.quality), '--resampleWidth', String(width), png, '--out', out], { stdio: 'ignore' })
}

/** Hidden but kept in the layout: a panel taken out of it makes the app re-measure, and the map redraw without its base. */
const HIDE_CHROME = `aside.panel, .map-controls, .maplibregl-control-container, .toast { visibility: hidden !important; }`

async function captureShot(name, spec) {
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    // A fresh browser per try: a crashed or stalled renderer never leaks into the next one.
    const browser = await launch()
    let page
    try {
      ;({ page } = await openSession(browser, spec.lang, spec.viewport ?? PHONE))
      await ready(page)
      const file = path.join(outDir, `${name}.png`)
      if (spec.saved) {
        const saved = await savedScene(page, spec.lang)
        await save(page, file)
        say(`${name}: saved ${saved.join(' | ')} (try ${attempt})`)
        return
      }
      if (spec.before) await spec.before(page)
      let line = 'start screen, Spain view'
      if (spec.trip) line = tripLine(spec.trip, await planTrip(page, spec.trip))
      await mapIdle(page, 3000)
      if (spec.readme) {
        if (spec.prepare) await spec.prepare(page)
        await save(page, file)
        writeReadmeJpeg(file, spec.id)
        say(`${name}: ${line} (try ${attempt})`)
        return
      }
      if (spec.bare) {
        if (spec.zoom) { await zoomOnRide(page, spec.zoom); await sleep(2500); await mapIdle(page, 3000) }
        // Measured with the side panel still there: the app framed the map to the right of it.
        const measured = await boxes(page)
        await page.addStyleTag({ content: HIDE_CHROME })
        await sleep(800)
        await save(page, file, measured)
        say(`${name}: ${line} (try ${attempt})`)
        return
      }
      if (spec.sheet === 'peek') { await sheetToPeek(page); await mapIdle(page, 1000) }
      if (spec.sheet === 'full') await sheetToFull(page)
      if (spec.zoom) { await zoomOnRide(page, spec.zoom); await sleep(2500); await mapIdle(page, 3000) }
      // The English shot frames like the Spanish one: it starts from what the Spanish one ended with.
      const cameraFile = (lang) => path.join(outDir, `${spec.id}-${lang}.camera.json`)
      const spanish = spec.lang !== 'es' && fs.existsSync(cameraFile('es')) ? JSON.parse(fs.readFileSync(cameraFile('es'), 'utf8')) : null
      const prepared = spec.prepare ? await spec.prepare(page, spanish?.prepared?.width) : null
      const crop = spec.clearCrop ?? cropOf(spec.id)
      const zoomAbout = async (factor) => (spec.keep === keepGorge || spec.keep === keepGrazalema ? zoomBy(page, { factor, pointer: [180, 300], measure: async () => { const [a, c] = await endPins(page); return Math.hypot(a[0] - c[0], a[1] - c[1]) }, strict: false }) : spec.trip ? zoomOnRide(page, { factor }) : zoomBy(page, { factor, pointer: [180, 300], measure: async () => { const m = await withScreenPixels(page, overlayBoxInPixels, { top: 120, bottom: (await boxes(page)).mapBottom }); return m.y1 - m.y0 } }))
      if (spanish?.ok) {
        if (spanish.zoom !== 1) { await zoomAbout(spanish.zoom); await sleep(1500) }
        if (spanish.moved[0] || spanish.moved[1]) { await panMap(page, ...spanish.moved); await sleep(800) }
      }
      const cleared = await clearEdges(page, crop, zoomAbout, spec.keep ?? keepPins, spec.labels)
      if (spec.lang === 'es') fs.writeFileSync(cameraFile('es'), JSON.stringify({ ...cleared, prepared }))
      if (spec.finish) await spec.finish(page)
      await save(page, file)
      const after = spec.finish ? { clean: 'checked before the sheet opened' } : await cutsAtEdges(page, crop, spec.keep ?? keepPins, spec.labels)
      say(`${name}: ${line}; edges ${after.clean ? 'clean' : 'STILL CUT ' + JSON.stringify(after)} ${JSON.stringify(cleared)} (try ${attempt})`)
      return
    } catch (e) {
      console.log(`${name} try ${attempt}: ${e.message}`)
      if (process.env.FAIL_SHOTS_DIR && page) await page.screenshot({ path: path.join(process.env.FAIL_SHOTS_DIR, `fail-${name}-${attempt}.png`) }).catch(() => {})
    } finally {
      await browser.close().catch(() => {})
    }
  }
  say(`${name}: FAILED after ${TRIES} tries`)
}

for (const [name, spec] of Object.entries(SHOTS)) if (!only || only.has(name)) await captureShot(name, spec)
fs.appendFileSync(path.join(outDir, 'captures.log'), `${new Date().toISOString()}\n${log.join('\n')}\n`)
