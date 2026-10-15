import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import {
  locateAlongLine,
  maxDeviationMeters,
  sliceLineByDistance,
} from '@/shared/routing/auto-snap/line-deviation'
import { pathLengthMeters } from '@/shared/routing/haversine'

const LAT = 52
const METERS_PER_DEG_LAT = 110_540

const straight: Position[] = [
  [13, LAT],
  [13.02, LAT],
]

describe('maxDeviationMeters', () => {
  it('is zero for identical lines', () => {
    expect(maxDeviationMeters(straight, [...straight])).toBe(0)
  })

  it('is about the offset for parallel lines 10 m apart', () => {
    const offset = 10 / METERS_PER_DEG_LAT
    const parallel: Position[] = [
      [13, LAT + offset],
      [13.02, LAT + offset],
    ]
    expect(Math.abs(maxDeviationMeters(straight, parallel) - 10)).toBeLessThan(0.5)
  })

  it('is symmetric, catching a detour on either side', () => {
    const bump = 30 / METERS_PER_DEG_LAT
    const detour: Position[] = [
      [13, LAT],
      [13.01, LAT + bump],
      [13.02, LAT],
    ]
    const forward = maxDeviationMeters(straight, detour)
    expect(Math.abs(forward - 30)).toBeLessThan(0.5)
    expect(maxDeviationMeters(detour, straight)).toBeCloseTo(forward, 6)
  })

  it('is Infinity when a line has fewer than two points', () => {
    expect(maxDeviationMeters([[13, LAT]], straight)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('sliceLineByDistance', () => {
  it('returns the whole line for the full range', () => {
    const total = pathLengthMeters(straight)
    const slice = sliceLineByDistance(straight, 0, total)
    expect(slice[0]?.[0]).toBeCloseTo(13, 9)
    expect(slice.at(-1)?.[0]).toBeCloseTo(13.02, 9)
  })

  it('interpolates both ends of a middle range', () => {
    const total = pathLengthMeters(straight)
    const slice = sliceLineByDistance(straight, total / 4, (3 * total) / 4)
    expect(slice).toHaveLength(2)
    expect(slice[0]?.[0]).toBeCloseTo(13.005, 6)
    expect(slice[1]?.[0]).toBeCloseTo(13.015, 6)
  })

  it('keeps the vertices inside the range', () => {
    const corner: Position[] = [
      [13, LAT],
      [13.01, LAT],
      [13.01, LAT + 0.01],
    ]
    const total = pathLengthMeters(corner)
    const slice = sliceLineByDistance(corner, total * 0.1, total * 0.9)
    expect(slice).toHaveLength(3)
    expect(slice[1]).toEqual([13.01, LAT])
  })
})

describe('locateAlongLine', () => {
  it('finds the along-line distance and gap of a point beside the line', () => {
    const total = pathLengthMeters(straight)
    const point: Position = [13.01, LAT + 5 / METERS_PER_DEG_LAT]
    const hit = locateAlongLine(straight, point)
    expect(hit.alongMeters).toBeCloseTo(total / 2, 0)
    expect(hit.distanceMeters).toBeCloseTo(5, 0)
  })

  it('searches only at or after fromMeters, so a revisited point resolves to the later visit', () => {
    const outAndBack: Position[] = [straight[0] ?? [], straight[1] ?? [], straight[0] ?? []]
    const oneWay = pathLengthMeters(straight)
    expect(locateAlongLine(outAndBack, straight[0] ?? []).alongMeters).toBe(0)
    expect(locateAlongLine(outAndBack, straight[0] ?? [], oneWay / 2).alongMeters).toBeCloseTo(
      2 * oneWay,
      0,
    )
  })
})
