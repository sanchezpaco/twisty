import { describe, expect, it } from 'vitest'
import { streetSearchRow } from './network.svelte'

describe('the street search row', () => {
  it('is offered for a query long enough, with a connection', () => {
    expect(streetSearchRow(true, true)).toBe('offer')
  })

  it('says it needs a connection when there is none, so nothing is sent', () => {
    expect(streetSearchRow(true, false)).toBe('offline')
  })

  it('is not there for a short query, online or not', () => {
    expect(streetSearchRow(false, true)).toBeNull()
    expect(streetSearchRow(false, false)).toBeNull()
  })
})
