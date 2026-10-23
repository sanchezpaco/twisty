import { coveredShare, type LocatedRoad, PolylineIndex } from './roads'

/** H11: a bad road is ridden when an option follows at least this much of it. */
export const BAD_ROAD_MIN_M = 300

/** The bad roads an option rides, by id, with the metres ridden. */
export function badRoadsRidden(index: PolylineIndex, bad: LocatedRoad[]): { id: string; riddenM: number }[] {
  return bad
    .map((road) => ({ id: road.id, riddenM: coveredShare(index, road.line) * road.lengthM }))
    .filter(({ riddenM }) => riddenM >= BAD_ROAD_MIN_M)
}

