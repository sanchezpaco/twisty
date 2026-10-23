declare module 'vt-pbf' {
  import type { LegacyTile } from 'geojson-vt'
  const vtpbf: { fromGeojsonVt(layers: Record<string, LegacyTile>, options: { extent: number; version: number }): Uint8Array }
  export default vtpbf
}
