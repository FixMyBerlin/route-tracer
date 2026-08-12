import type { FeatureCollection, Point } from 'geojson'
import type { ImageCoords } from '@/shared/reference-image/types'

export function cornersToGeoJson(corners: ImageCoords): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: corners.map((coordinates, cornerIndex) => ({
      type: 'Feature',
      properties: { cornerIndex },
      geometry: {
        type: 'Point',
        coordinates,
      },
    })),
  }
}
