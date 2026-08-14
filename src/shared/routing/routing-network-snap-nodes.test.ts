import type { FeatureCollection, LineString } from 'geojson'
import { describe, expect, it } from 'vitest'
import { routingNetworkSnapNodes } from '@/shared/routing/routing-network-snap-nodes'

function lineCollection(...paths: [number, number][][]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: paths.map((coordinates) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    })),
  }
}

describe('routingNetworkSnapNodes', () => {
  it('returns unique edge vertices so shared junctions appear once', () => {
    const nodes = routingNetworkSnapNodes(
      lineCollection(
        [
          [13, 52],
          [13.1, 52],
        ],
        [
          [13.1, 52],
          [13.2, 52],
        ],
      ),
    )

    expect(nodes.features).toHaveLength(3)
    expect(nodes.features.map((feature) => feature.geometry.coordinates)).toEqual([
      [13, 52],
      [13.1, 52],
      [13.2, 52],
    ])
  })

  it('returns an empty collection when there are no edges', () => {
    expect(routingNetworkSnapNodes(lineCollection()).features).toEqual([])
  })
})
