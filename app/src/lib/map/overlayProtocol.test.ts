import { describe, expect, it } from 'vitest'
import { loadOverlayTile } from './overlayProtocol'

const respond = (body: string, init: ResponseInit) => (async () => new Response(body, init)) as typeof fetch

describe('loadOverlayTile', () => {
  it('returns the bytes of a tile that exists', async () => {
    const tile = await loadOverlayTile('5/15/12', undefined, respond('tile', { headers: { 'content-type': 'application/x-protobuf' } }))
    expect(new TextDecoder().decode(tile)).toBe('tile')
  })

  it('reads a 404 as an empty tile', async () => {
    expect((await loadOverlayTile('9/100/200', undefined, respond('', { status: 404 }))).byteLength).toBe(0)
  })

  it('reads the index page a server answers for an unknown path as an empty tile', async () => {
    const page = respond('<!doctype html>', { headers: { 'content-type': 'text/html' } })
    expect((await loadOverlayTile('9/100/200', undefined, page)).byteLength).toBe(0)
  })

  it('does not hide a network failure', async () => {
    const offline = (async () => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch
    await expect(loadOverlayTile('5/15/12', undefined, offline)).rejects.toThrow('Failed to fetch')
  })
})
