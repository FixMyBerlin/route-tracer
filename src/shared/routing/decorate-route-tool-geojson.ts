import type { FeatureCollection, LineString } from 'geojson'
import { isOriginalOsmNode } from '@/shared/routing/densify-osm-for-snapping'
import {
  ROAD_SNAP_RADIUS_METERS,
  haversineMeters,
  nearestPointOnLines,
} from '@/shared/routing/nearest-road-point'

const WAYPOINT_TYPES = new Set(['snapped-waypoint', 'free-waypoint'])

/**
 * Tag confirmed waypoints as graph-node (`edge`) vs mid-block/free (`mid`),
 * hide WASM hovers that are farther than the 5 m road radius, and add a
 * preview point on the nearest road when the cursor is in range.
 */
export function decorateRouteToolGeoJson(
  geojson: FeatureCollection,
  pointer: [number, number] | null,
  network: FeatureCollection<LineString> | null,
): FeatureCollection {
  const onRoad = pointer && network ? nearestPointOnLines(network, pointer[0], pointer[1]) : null

  const features = geojson.features.flatMap((feature) => {
    if (feature.geometry?.type !== 'Point') return [feature]
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') return [feature]

    const type = String(feature.properties?.type ?? '')
    const kind = type === 'snapped-waypoint' && isOriginalOsmNode(lng, lat) ? 'edge' : 'mid'
    const properties = WAYPOINT_TYPES.has(type)
      ? { ...feature.properties, kind }
      : feature.properties

    if (feature.properties?.hovered && pointer) {
      const dist = haversineMeters(pointer[1], pointer[0], lat, lng)
      if (dist > ROAD_SNAP_RADIUS_METERS) {
        const rest = { ...properties }
        delete rest.hovered
        return [{ ...feature, properties: rest }]
      }
    }

    return [{ ...feature, properties }]
  })

  if (onRoad && pointer) {
    const previewAlreadyShown = features.some((feature) => {
      if (feature.geometry?.type !== 'Point' || !feature.properties?.hovered) return false
      const [lng, lat] = feature.geometry.coordinates
      if (typeof lng !== 'number' || typeof lat !== 'number') return false
      return haversineMeters(onRoad.lat, onRoad.lon, lat, lng) < 2
    })
    if (!previewAlreadyShown) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [onRoad.lon, onRoad.lat] },
        properties: { type: 'snap-preview', kind: 'mid', hovered: true },
      })
    }
  }

  return { ...geojson, features }
}
