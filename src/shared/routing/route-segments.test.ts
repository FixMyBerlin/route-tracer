import { describe, expect, it } from 'vitest'
import { buildRouteExportGeoJson, type RouteSegment } from '@/shared/routing/route-segments'

function countCoords(collection: ReturnType<typeof buildRouteExportGeoJson>) {
  return collection.features.reduce((sum, feature) => {
    if (feature.geometry.type !== 'LineString') return sum
    return sum + feature.geometry.coordinates.length
  }, 0)
}

describe('buildRouteExportGeoJson', () => {
  it('simplifies densified colinear vertices by default', () => {
    const segments: RouteSegment[] = [
      {
        segment_index: 0,
        segment_kind: 'snapped',
        // Straight east–west line with many intermediate points (~few cm apart)
        coordinates: Array.from({ length: 40 }, (_, index) => [13.4 + index * 0.000001, 52.5]),
      },
    ]

    const simplified = buildRouteExportGeoJson(segments)
    const raw = buildRouteExportGeoJson(segments, { simplify: false })

    expect(countCoords(raw)).toBe(40)
    expect(countCoords(simplified)).toBeLessThan(countCoords(raw))
    expect(countCoords(simplified)).toBeGreaterThanOrEqual(2)

    const first = simplified.features[0]
    expect(first?.geometry.type).toBe('LineString')
    if (first?.geometry.type === 'LineString') {
      expect(first.geometry.coordinates[0]).toEqual([13.4, 52.5])
      expect(first.geometry.coordinates.at(-1)?.[0]).toBeCloseTo(13.4 + 39 * 0.000001, 6)
    }
  })

  it('preserves segment properties when simplifying', () => {
    const segments: RouteSegment[] = [
      {
        segment_index: 0,
        segment_kind: 'manual',
        coordinates: [
          [13.4, 52.5],
          [13.401, 52.501],
          [13.402, 52.5],
        ],
        osm_way_ids: [1, 2],
      },
    ]

    const geojson = buildRouteExportGeoJson(segments)
    expect(geojson.features[0]?.properties).toMatchObject({
      segment_index: 0,
      segment_kind: 'manual',
      osm_way_ids: [1, 2],
    })
  })
})
