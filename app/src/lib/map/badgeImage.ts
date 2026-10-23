// MapLibre reads an SDF icon's alpha as 0.75 at the shape's edge, falling by 1/8 per pixel outwards.
const EDGE_ALPHA = 0.75
const SDF_RANGE_PX = 8

export interface SdfImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

/** A filled circle as a signed distance field, so the layer can colour it and draw a halo of any width up to `margin`. */
export function circleSdf(radius: number, margin: number): SdfImage {
  const size = 2 * (radius + margin)
  const data = new Uint8ClampedArray(size * size * 4)
  const center = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distanceOutside = Math.hypot(x + 0.5 - center, y + 0.5 - center) - radius
      const alpha = Math.min(1, Math.max(0, EDGE_ALPHA - distanceOutside / SDF_RANGE_PX))
      data[(y * size + x) * 4 + 3] = Math.round(alpha * 255)
    }
  }
  return { width: size, height: size, data }
}
