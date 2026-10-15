import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { pointToPolylineMeters } from '@/shared/routing/auto-snap/local-meters'
import { createPointIndex, createSegmentIndex } from '@/shared/routing/auto-snap/point-index'
import { haversineMeters } from '@/shared/routing/haversine'

const ORIGIN_LON = 13.4
const ORIGIN_LAT = 52.5

/** Position `east` and `north` metres from the test origin. */
function offset(east: number, north: number): Position {
  const cosLat = Math.cos((ORIGIN_LAT * Math.PI) / 180)
  return [ORIGIN_LON + east / (111_320 * cosLat), ORIGIN_LAT + north / 110_540]
}

function distance(a: Position, b: Position) {
  return haversineMeters(a[1] ?? 0, a[0] ?? 0, b[1] ?? 0, b[0] ?? 0)
}

/** Deterministic pseudo-random numbers in [0, 1). */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return state / 4_294_967_296
  }
}

describe('createPointIndex', () => {
  const grid: Position[] = []
  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 10; j += 1) grid.push(offset(i * 100, j * 100))
  }
  const index = createPointIndex(grid)

  it('finds the nearest point of a grid', () => {
    const hit = index.nearest(offset(203, 298), 50)
    expect(hit?.index).toBe(2 * 10 + 3)
    expect(hit?.position).toEqual(grid[23])
    expect(hit?.distanceMeters ?? Number.NaN).toBeLessThan(5)
  })

  it('returns null beyond maxMeters', () => {
    expect(index.nearest(offset(5000, 0), 100)).toBeNull()
    expect(index.nearest(offset(5000, 0), 6000)).not.toBeNull()
  })

  it('returns null for an empty set', () => {
    expect(createPointIndex([]).nearest(offset(0, 0), 1000)).toBeNull()
  })

  it('matches brute force for 200 random points', () => {
    const random = seededRandom(7)
    const points = Array.from({ length: 200 }, () => offset(random() * 2000, random() * 2000))
    const pointIndex = createPointIndex(points)

    for (let query = 0; query < 200; query += 1) {
      const position = offset(random() * 2400 - 200, random() * 2400 - 200)
      let bestDistance = Number.POSITIVE_INFINITY
      for (const point of points) bestDistance = Math.min(bestDistance, distance(position, point))

      const hit = pointIndex.nearest(position, 150)
      if (bestDistance > 150) {
        expect(hit).toBeNull()
      } else {
        expect(hit?.distanceMeters ?? Number.NaN).toBeCloseTo(bestDistance, 3)
      }
    }
  })
})

describe('createSegmentIndex', () => {
  it('matches brute force distance to a polyline', () => {
    const random = seededRandom(11)
    const line: Position[] = []
    for (let i = 0; i < 60; i += 1) {
      line.push(offset(i * 40 + random() * 30, random() * 400 - 200))
    }
    const segmentIndex = createSegmentIndex(line)

    for (let query = 0; query < 200; query += 1) {
      const position = offset(random() * 2600 - 200, random() * 600 - 300)
      const brute = pointToPolylineMeters(position, line).distance
      const indexed = segmentIndex.distance(position, 300)
      if (brute > 300) {
        expect(indexed).toBe(Number.POSITIVE_INFINITY)
      } else {
        expect(indexed).toBeCloseTo(brute, 1)
      }
    }
  })
})
