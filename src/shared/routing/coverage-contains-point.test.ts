import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { describe, expect, test } from 'vitest'
import { coverageContainsPoint } from '@/shared/routing/coverage-contains-point'

const square = (west: number, south: number, size: number) => [
  [west, south],
  [west + size, south],
  [west + size, south + size],
  [west, south + size],
  [west, south],
]

const withHole: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [square(0, 0, 10), square(4, 4, 2)] },
}

const twoAreas: Feature<MultiPolygon> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0, 1)], [square(5, 5, 1)]] },
}

describe('coverageContainsPoint', () => {
  test('nothing is loaded without coverage', () => {
    expect(coverageContainsPoint(null, 1, 1)).toBe(false)
  })

  test('inside the outline but not inside a gap', () => {
    expect(coverageContainsPoint(withHole, 1, 1)).toBe(true)
    expect(coverageContainsPoint(withHole, 5, 5)).toBe(false)
    expect(coverageContainsPoint(withHole, 11, 1)).toBe(false)
  })

  test('any of several loaded areas counts', () => {
    expect(coverageContainsPoint(twoAreas, 5.5, 5.5)).toBe(true)
    expect(coverageContainsPoint(twoAreas, 3, 3)).toBe(false)
  })
})
