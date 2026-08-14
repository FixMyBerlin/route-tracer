import { polygon } from '@turf/helpers'
import { describe, expect, it } from 'vitest'
import { coverageUnloadedMask } from '@/shared/routing/coverage-mask'

describe('coverageUnloadedMask', () => {
  it('is empty until coverage exists', () => {
    expect(coverageUnloadedMask(null).features).toEqual([])
    expect(coverageUnloadedMask(undefined).features).toEqual([])
  })

  it('subtracts loaded coverage from the world so the hole is the covered bbox', () => {
    const covered = polygon([
      [
        [13, 52],
        [13.1, 52],
        [13.1, 52.1],
        [13, 52.1],
        [13, 52],
      ],
    ])
    const mask = coverageUnloadedMask(covered)
    expect(mask.features).toHaveLength(1)
    const geometry = mask.features[0]?.geometry
    expect(geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon').toBe(true)
    const rings = geometry?.type === 'Polygon' ? geometry.coordinates : geometry?.coordinates[0]
    expect(rings && rings.length >= 2).toBe(true)
  })
})
