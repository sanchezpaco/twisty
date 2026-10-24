import { describe, expect, it } from 'vitest'
import {
  daysAgo,
  HISTORY_MAX,
  type HistoryTrip,
  historyPlace,
  needsHere,
  parseHistory,
  recordHandedOver,
  recordPlanned,
  removeTrip,
  restoreTrips,
  restoreTrip,
  sameTrip,
  serializeHistory,
  type TripInput,
} from './tripHistory'

const place = (label: string, lon: number) => ({ label, position: [lon, 40] as [number, number] })
const input = (from: string, to: string, at = 1): TripInput => ({
  from: place(from, 1),
  to: place(to, 2),
  via: [],
  includeTracks: false,
  selected: 3,
  at,
})
const handed = (from: string, to: string, at = 1): HistoryTrip => ({ ...input(from, to, at), handed: true })
const planned = (from: string, to: string, at = 1): HistoryTrip => ({ ...input(from, to, at), handed: false })
const names = (list: HistoryTrip[]) => list.map((entry) => `${'label' in entry.from ? entry.from.label : 'here'}>${'label' in entry.to ? entry.to.label : 'here'}${entry.handed ? '' : '?'}`)

describe('a trip with stops', () => {
  it('is another trip than the same ends without them, or with them in another order', () => {
    const plain = input('A', 'B')
    const viaC = { ...plain, via: [place('C', 3)] }
    const viaCD = { ...plain, via: [place('C', 3), place('D', 4)] }
    const viaDC = { ...plain, via: [place('D', 4), place('C', 3)] }
    expect(sameTrip(plain, viaC)).toBe(false)
    expect(sameTrip(viaCD, viaDC)).toBe(false)
    expect(sameTrip(viaCD, { ...viaCD, at: 5 })).toBe(true)
  })

  it('keeps its stops, and a trip kept before stops existed reads with none', () => {
    const viaC: HistoryTrip = { ...handed('A', 'B'), via: [place('C', 3)] }
    expect(parseHistory(serializeHistory([viaC, handed('A', 'D')]))).toEqual([viaC, handed('A', 'D')])
    expect(serializeHistory([handed('A', 'D')])).not.toContain('via')
  })
})

describe('handing a ride over', () => {
  it('puts the trip first', () => {
    expect(names(recordHandedOver([handed('A', 'B')], input('C', 'D')))).toEqual(['C>D', 'A>B'])
  })

  it('moves a trip handed before to the top instead of repeating it, with the newest stop, switch and time', () => {
    const list = [handed('A', 'B', 1), handed('C', 'D', 2)]
    const again = { ...input('C', 'D', 9), selected: 6, includeTracks: true }
    const result = recordHandedOver(list, again)
    expect(names(result)).toEqual(['C>D', 'A>B'])
    expect(result[0]).toMatchObject({ selected: 6, includeTracks: true, at: 9, handed: true })
  })

  it('promotes the ride that was only on screen to a normal entry', () => {
    const result = recordHandedOver([planned('A', 'B')], input('A', 'B', 5))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ handed: true, at: 5 })
  })

  it('keeps another never-handed entry', () => {
    expect(names(recordHandedOver([planned('A', 'B')], input('C', 'D')))).toEqual(['C>D', 'A>B?'])
  })

  it('keeps the newest entries when the list is full', () => {
    const full = Array.from({ length: HISTORY_MAX }, (_, i) => handed(`P${i}`, 'Z'))
    const result = recordHandedOver(full, input('new', 'trip'))
    expect(result).toHaveLength(HISTORY_MAX)
    expect(names(result)[0]).toBe('new>trip')
    expect(names(result)).not.toContain(`P${HISTORY_MAX - 1}>Z`)
  })
})

describe('leaving a ride on screen', () => {
  it('adds the ride as a never-handed entry on top', () => {
    expect(names(recordPlanned([handed('A', 'B')], input('C', 'D')))).toEqual(['C>D?', 'A>B'])
  })

  it('swaps the previous never-handed entry for the newer ride', () => {
    const result = recordPlanned([planned('A', 'B'), handed('X', 'Y')], input('C', 'D'))
    expect(names(result)).toEqual(['C>D?', 'X>Y'])
  })

  it('refreshes the same never-handed trip without duplicating it', () => {
    const result = recordPlanned([planned('A', 'B', 1)], { ...input('A', 'B', 8), selected: 0 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ handed: false, at: 8, selected: 0 })
  })

  it('leaves a trip that was handed over before as handed, moved to the top with its new stop', () => {
    const result = recordPlanned([handed('X', 'Y', 1), handed('A', 'B', 2)], { ...input('A', 'B', 9), selected: 1 })
    expect(names(result)).toEqual(['A>B', 'X>Y'])
    expect(result[0]).toMatchObject({ handed: true, at: 9, selected: 1 })
  })

  it('never holds more than one never-handed entry', () => {
    let list: HistoryTrip[] = []
    for (const to of ['B', 'C', 'D']) list = recordPlanned(list, input('A', to))
    expect(list.filter((entry) => !entry.handed)).toHaveLength(1)
  })

  it('does not push a full list past its limit', () => {
    const full = Array.from({ length: HISTORY_MAX }, (_, i) => handed(`P${i}`, 'Z'))
    expect(recordPlanned(full, input('new', 'trip'))).toHaveLength(HISTORY_MAX)
  })
})

describe('the rider\'s own position', () => {
  it('keeps no coordinates, only that it was "here"', () => {
    const here = historyPlace({ label: 'My location', position: [-3.7, 40.4], here: true })
    expect(here).toEqual({ here: true })
    expect(JSON.stringify(here)).not.toContain('-3.7')
  })

  it('counts every "here" start as the same start', () => {
    const a: TripInput = { ...input('x', 'B'), from: { here: true } }
    const b: TripInput = { ...input('y', 'B'), from: { here: true } }
    expect(sameTrip(a, b)).toBe(true)
  })

  it('plans a loop from "here" again from today\'s position, at both ends', () => {
    const loop: TripInput = { ...input('x', 'y'), from: { here: true }, via: [place('Teruel', 3)], to: { here: true } }
    const today = { label: 'My location', position: [-0.9, 41.6] as [number, number], here: true as const }
    expect(needsHere(loop)).toBe(true)
    expect(restoreTrip(loop, today)).toEqual({ from: today, via: [place('Teruel', 3)], to: today })
  })

  it('plans nothing while the position a "here" end needs is unknown', () => {
    expect(restoreTrip({ ...input('A', 'B'), to: { here: true } }, null)).toBeNull()
  })

  it('needs no position for a trip between places', () => {
    const trip = { ...input('A', 'B'), via: [place('C', 3)] }
    expect(needsHere(trip)).toBe(false)
    expect(restoreTrip(trip, null)).toEqual({ from: place('A', 1), via: [place('C', 3)], to: place('B', 2) })
  })

  it('tells a trip from its reverse', () => {
    expect(sameTrip(input('A', 'B'), { ...input('B', 'A'), from: place('B', 2), to: place('A', 1) })).toBe(false)
  })
})

describe('removing and storing', () => {
  it('removes one entry by position', () => {
    expect(names(removeTrip([handed('A', 'B'), handed('C', 'D')], 0))).toEqual(['C>D'])
  })

  it('puts cleared trips back as they were', () => {
    const before = [handed('A', 'B', 3), handed('C', 'D', 2), planned('E', 'F', 1)]
    expect(restoreTrips([], before)).toEqual(before)
  })

  it('keeps a trip recorded since the clear, and its newer entry, when the clear is undone', () => {
    const before = [handed('A', 'B', 3), planned('C', 'D', 2)]
    const since = [handed('C', 'D', 5), planned('G', 'H', 4)]
    expect(names(restoreTrips(since, before))).toEqual(['C>D', 'G>H?', 'A>B'])
  })

  it('keeps one never-handed trip and the limit after an undo', () => {
    const before = [planned('A', 'B', 2), ...Array.from({ length: 4 }, (_, i) => handed(`P${i}`, 'Z', 1))]
    const result = restoreTrips([planned('C', 'D', 3), handed('E', 'F', 3)], before)
    expect(names(result).filter((name) => name.endsWith('?'))).toEqual(['C>D?'])
    expect(result).toHaveLength(HISTORY_MAX)
  })

  it('round-trips the list', () => {
    const list = [handed('A', 'B', 2), planned('C', 'D', 1)]
    expect(parseHistory(serializeHistory(list))).toEqual(list)
  })

  it.each([
    ['nothing stored', null],
    ['not JSON', '[{'],
    ['not a list', '{"a":1}'],
  ])('reads %s as an empty history', (_, text) => {
    expect(parseHistory(text)).toEqual([])
  })

  it('drops a malformed entry and keeps the others', () => {
    const text = JSON.stringify([handed('A', 'B'), { ...handed('C', 'D'), selected: -1 }, { ...handed('E', 'F'), to: { label: 'x' } }])
    expect(names(parseHistory(text))).toEqual(['A>B'])
  })

  it('keeps one never-handed entry and the limit even if the stored list says otherwise', () => {
    const many = [planned('A', 'B'), planned('C', 'D'), ...Array.from({ length: 8 }, (_, i) => handed(`P${i}`, 'Z'))]
    const result = parseHistory(JSON.stringify(many))
    expect(result.filter((entry) => !entry.handed)).toHaveLength(1)
    expect(result).toHaveLength(HISTORY_MAX)
  })
})

describe('days ago', () => {
  const noon = (day: number) => new Date(2026, 9, day, 12).getTime()

  it('counts calendar days, not 24-hour spans', () => {
    expect(daysAgo(new Date(2026, 9, 14, 23, 59).getTime(), new Date(2026, 9, 15, 0, 1).getTime())).toBe(1)
    expect(daysAgo(noon(15), noon(15))).toBe(0)
    expect(daysAgo(noon(12), noon(15))).toBe(3)
  })
})
