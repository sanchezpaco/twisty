// Renders the store assets from the captures (capture.mjs) with headless Chrome, as 24-bit PNGs in fastlane supply's
// layout, plus two contact sheets of the whole set.
// Usage: node render.mjs <captures-dir> <play-dir> <sheets-dir> [scratch-dir]
//   <play-dir>/<locale>/images/phoneScreenshots/1.png … 8.png, featureGraphic.png, icon.png
// Needs ffmpeg on the PATH: Chrome's PNGs carry an alpha channel, and Google Play wants none.
// ONLY=<substring of an output path> renders just the matching files, to iterate on one asset.
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { launch, REPO } from './lib.mjs'
import { captionPlain } from './caption.mjs'

const [capturesDir, playDir, sheetsDir, scratchArg] = process.argv.slice(2)
if (!capturesDir || !playDir || !sheetsDir) throw new Error('usage: node render.mjs <captures-dir> <play-dir> <sheets-dir> [scratch-dir]')
const scratch = scratchArg ?? fs.mkdtempSync(path.join(os.tmpdir(), 'twisty-store-'))
for (const dir of [playDir, sheetsDir, scratch]) fs.mkdirSync(dir, { recursive: true })

const HERE = path.dirname(new URL(import.meta.url).pathname)
const assets = JSON.parse(fs.readFileSync(path.join(HERE, 'assets.json'), 'utf8'))

/** The listing's languages: the app's language code and Google Play's locale folder. */
const LOCALES = [
  { lang: 'es', locale: 'es-ES' },
  { lang: 'en', locale: 'en-US' },
]
/** The feature graphic the listing uses (assets.json `feature.variants`). */
const FEATURE = 'a-route'

const ROOTS = {
  '/captures/': path.resolve(capturesDir),
  '/fonts/': path.join(REPO, 'app/node_modules/@fontsource-variable'),
  '/play/': path.resolve(playDir),
  '/': HERE,
}
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const prefix = Object.keys(ROOTS).find((p) => url.startsWith(p))
  const file = path.join(ROOTS[prefix], url.slice(prefix.length))
  if (!file.startsWith(ROOTS[prefix]) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`

const browser = await launch()
const report = []
const want = (file) => !process.env.ONLY || file.includes(process.env.ONLY)

async function render(page, target, { width, height }, file) {
  if (!want(file)) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.goto(base + target, { waitUntil: 'networkidle0' })
  try {
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 })
  } catch {
    // A capture missing from the folder: the rest of the set still renders, and the report says which one.
    report.push(`${file}  NOT RENDERED (its capture is missing?)`)
    return
  }
  await page.evaluate(() => document.fonts.ready)
  const info = await page.evaluate(() => window.renderInfo ?? null)
  const raw = path.join(scratch, path.relative(path.resolve(playDir, '..'), path.resolve(file)).replace(/[\\/]/g, '_'))
  await page.screenshot({ path: raw, clip: { x: 0, y: 0, width, height } })
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-pix_fmt', 'rgb24', file])
  report.push(`${file}  ${width}x${height}  ${fs.statSync(file).size} bytes${info ? '  ' + JSON.stringify(info) : ''}`)
}

const images = (locale) => path.join(playDir, locale, 'images')
const shotFile = (locale, n) => path.join(images(locale), 'phoneScreenshots', `${n}.png`)

try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e)))

  for (const { lang, locale } of LOCALES) {
    await render(page, `feature.html?variant=${FEATURE}&lang=${lang}`, { width: 1024, height: 500 }, path.join(images(locale), 'featureGraphic.png'))
    for (const [index, shot] of assets.screenshots.entries()) {
      await render(page, `screenshot.html?id=${shot.id}&lang=${lang}`, { width: 1080, height: 1920 }, shotFile(locale, index + 1))
    }
    await render(page, 'icon.html', { width: 512, height: 512 }, path.join(images(locale), 'icon.png'))
  }

  // The sheets: per language, the feature graphic and the icon, then the eight screenshots.
  const rel = (file) => `/play/${path.relative(playDir, file)}`
  const sheet = (scale) => ({
    rows: LOCALES.flatMap(({ locale }) => [
      {
        title: locale,
        items: [
          { src: rel(path.join(images(locale), 'featureGraphic.png')), w: 1024 * scale.feature, h: 500 * scale.feature, label: 'featureGraphic' },
          { src: rel(path.join(images(locale), 'icon.png')), w: 512 * scale.icon, h: 512 * scale.icon, label: 'icon', masked: scale.maskIcon },
        ],
      },
      { items: assets.screenshots.map((s, i) => ({ src: rel(shotFile(locale, i + 1)), w: 1080 * scale.shot, h: 1920 * scale.shot, label: `${i + 1} · ${s.id}` })) },
    ]),
  })
  const SHEETS = [
    ['contact-sheet.png', 'full', { feature: 1, icon: 0.5, shot: 0.4, maskIcon: false }, { width: 3800, height: 3060 }],
    ['contact-sheet-thumbnails.png', 'thumb', { feature: 0.5, icon: 0.1875, shot: 0.25, maskIcon: true }, { width: 2380, height: 1800 }],
  ]
  for (const [name, mode, scale, size] of SHEETS) {
    await render(page, `contact.html?mode=${mode}&layout=${encodeURIComponent(JSON.stringify(sheet(scale)))}`, size, path.join(sheetsDir, name))
  }
} finally {
  await browser.close()
  server.close()
}

const captions = [
  ...assets.screenshots.flatMap((s, i) => Object.entries(s.caption).map(([l, t]) => `${i + 1} ${s.id} ${l}: ${captionPlain(t)}`)),
  ...Object.entries(assets.feature.line).map(([l, t]) => `featureGraphic ${l}: ${assets.feature.wordmark} / ${t}`),
]
fs.writeFileSync(path.join(scratch, 'render.log'), [...report, '', ...captions, ''].join('\n'))
console.log([...report, '', ...captions].join('\n'))
