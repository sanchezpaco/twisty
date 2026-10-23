/** Colour maths for the theme tests: WCAG contrast, blending, and CIEDE2000 under colour-vision deficiency. */
export type Rgb = [number, number, number]

/** `#rrggbb`, or `rgba(r, g, b, a)`; the alpha is 1 for hex. */
export function parseColor(text: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(text)
  if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as Rgb, alpha: 1 }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(text)
  if (!rgba) throw new Error(`unsupported colour ${text}`)
  const [r, g, b, a = 1] = rgba[1].split(',').map(Number)
  return { rgb: [r, g, b], alpha: a }
}

/** The colour that results from `top` at `opacity` over an opaque `under`. */
export function over(top: string, opacity: number, under: string): string {
  const { rgb, alpha } = parseColor(top)
  const base = parseColor(under).rgb
  const a = alpha * opacity
  return toHex(rgb.map((channel, i) => channel * a + base[i] * (1 - a)) as Rgb)
}

const toHex = (rgb: Rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

const linear = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(parseColor(a).rgb), luminance(parseColor(b).rgb)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** CIE lightness, 0 to 100. */
export const lightness = (color: string): number => lab(parseColor(color).rgb)[0]

/** CIE LCh hue, in degrees. */
export function hue(color: string): number {
  const [, a, b] = lab(parseColor(color).rgb)
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
}

type Matrix = [Rgb, Rgb, Rgb]

/** Machado, Oliveira and Fernandes (2009), full severity. */
export const VISION: Record<'normal' | 'deutan' | 'protan' | 'tritan', Matrix | null> = {
  normal: null,
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

function simulate(rgb: Rgb, matrix: Matrix | null): Rgb {
  if (!matrix) return rgb
  const lin = rgb.map(linear)
  return matrix.map((row) => encode(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])) as Rgb
}

function encode(v: number): number {
  const c = Math.min(1, Math.max(0, v))
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
}

function lab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(linear)
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** CIEDE2000 colour difference between two colours as seen with the given vision. */
export function deltaE(a: string, b: string, vision: keyof typeof VISION = 'normal'): number {
  const matrix = VISION[vision]
  return ciede2000(lab(simulate(parseColor(a).rgb, matrix)), lab(simulate(parseColor(b).rgb, matrix)))
}

function ciede2000([l1, a1, b1]: Rgb, [l2, a2, b2]: Rgb): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const deg = (r: number) => (r * 180) / Math.PI
  const c1 = Math.hypot(a1, b1)
  const c2 = Math.hypot(a2, b2)
  const cBar7 = ((c1 + c2) / 2) ** 7
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)))
  const a1p = (1 + g) * a1
  const a2p = (1 + g) * a2
  const c1p = Math.hypot(a1p, b1)
  const c2p = Math.hypot(a2p, b2)
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (deg(Math.atan2(b, a)) + 360) % 360)
  const h1p = hue(b1, a1p)
  const h2p = hue(b2, a2p)
  const dLp = l2 - l1
  const dCp = c2p - c1p
  let dhp = 0
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp / 2))
  const lBar = (l1 + l2) / 2
  const cBarP = (c1p + c2p) / 2
  let hBarP = h1p + h2p
  if (c1p * c2p !== 0) hBarP = Math.abs(h1p - h2p) <= 180 ? hBarP / 2 : (hBarP + (hBarP < 360 ? 360 : -360)) / 2
  const t = 1 - 0.17 * Math.cos(rad(hBarP - 30)) + 0.24 * Math.cos(rad(2 * hBarP)) + 0.32 * Math.cos(rad(3 * hBarP + 6)) - 0.2 * Math.cos(rad(4 * hBarP - 63))
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2))
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7))
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2)
  const sc = 1 + 0.045 * cBarP
  const sh = 1 + 0.015 * cBarP * t
  const rt = -Math.sin(rad(2 * dTheta)) * rc
  return Math.sqrt((dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh))
}
