import difference from '@turf/difference'
import { featureCollection, polygon } from '@turf/helpers'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

const emptyMask: FeatureCollection<Polygon | MultiPolygon> = {
  type: 'FeatureCollection',
  features: [],
}

/**
 * Web Mercator-safe world ring. Slightly inside ±180 / ±85 so MapLibre can fill
 * the overlay without wrapping artefacts.
 */
const WORLD_RING: GeoJSON.Position[] = [
  [-179.9, -85],
  [179.9, -85],
  [179.9, 85],
  [-179.9, 85],
  [-179.9, -85],
]

/** Gray-out everything except the OSM coverage polygons already in the store. */
export function coverageUnloadedMask(
  coverage: Feature<Polygon | MultiPolygon> | null | undefined,
): FeatureCollection<Polygon | MultiPolygon> {
  if (!coverage) return emptyMask

  const world = polygon([WORLD_RING])
  const uncovered = difference(featureCollection([world, coverage]))
  if (!uncovered) return emptyMask

  return { type: 'FeatureCollection', features: [uncovered] }
}
