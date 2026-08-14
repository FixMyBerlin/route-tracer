import type { Feature, FeatureCollection, LineString, Point } from 'geojson'

const emptyPointCollection: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
}

/**
 * Unique vertices of routing-graph edges — the nodes route-snapper can jump to.
 */
export function routingNetworkSnapNodes(
  edges: FeatureCollection<LineString>,
): FeatureCollection<Point> {
  const seen = new Set<string>()
  const features: Feature<Point>[] = []

  for (const feature of edges.features) {
    if (feature.geometry.type !== 'LineString') continue
    for (const coord of feature.geometry.coordinates) {
      const lng = coord[0]
      const lat = coord[1]
      if (typeof lng !== 'number' || typeof lat !== 'number') continue
      const key = `${lng},${lat}`
      if (seen.has(key)) continue
      seen.add(key)
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [lng, lat] },
      })
    }
  }

  return features.length === 0 ? emptyPointCollection : { type: 'FeatureCollection', features }
}
