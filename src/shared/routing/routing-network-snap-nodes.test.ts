import { describe, expect, it } from 'vitest'
import { parseSnappableNodesGeoJson } from '@/shared/routing/routing-network-snap-nodes'

describe('parseSnappableNodesGeoJson', () => {
  it('keeps Point features from debugSnappableNodes output', () => {
    const nodes = parseSnappableNodesGeoJson({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [13, 52] },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [13, 52],
              [13.1, 52],
            ],
          },
        },
      ],
    })

    expect(nodes.features).toHaveLength(1)
    expect(nodes.features[0]?.geometry.coordinates).toEqual([13, 52])
  })

  it('returns an empty collection for invalid input', () => {
    expect(parseSnappableNodesGeoJson(null).features).toEqual([])
    expect(
      parseSnappableNodesGeoJson({ type: 'FeatureCollection', features: [] }).features,
    ).toEqual([])
  })
})
