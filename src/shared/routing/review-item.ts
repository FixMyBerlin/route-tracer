import type { FeatureCollection, LineString, Position } from 'geojson'

/** A place on the route the user should look at, highlighted on the map. */
export type ReviewItem = {
  id: string
  kind: 'changed' | 'off-track' | 'freehand'
  title: string
  coordinates: Position[]
}

export function reviewItemsGeoJson(items: ReviewItem[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: items
      .filter((item) => item.coordinates.length >= 2)
      .map((item) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: item.coordinates },
        properties: { id: item.id, kind: item.kind },
      })),
  }
}
