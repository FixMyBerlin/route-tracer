import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import { isOriginalOsmNode } from '@/shared/routing/densify-osm-for-snapping'
import { haversineMeters, nearestPointOnLines } from '@/shared/routing/nearest-road-point'
import { normalizeRouteToolGeoJson, segmentsToWaypoints } from '@/shared/routing/route-segments'

const WAYPOINT_TYPES = new Set(['snapped-waypoint', 'free-waypoint'])
const CLICK_INDEX_MATCH_METERS = 2

/**
 * Tag confirmed waypoints as graph-node (`edge`) vs mid-block/free (`mid`),
 * and add a preview point on the nearest road when the cursor is within 5 m.
 */
export function decorateRouteToolGeoJson(
  geojson: FeatureCollection,
  pointer: [number, number] | null,
  network: FeatureCollection<LineString> | null,
): FeatureCollection {
  const onRoad = pointer && network ? nearestPointOnLines(network, pointer[0], pointer[1]) : null

  const features = geojson.features.map((feature) => {
    if (feature.geometry?.type !== 'Point') return feature
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') return feature

    const type = String(feature.properties?.type ?? '')
    if (!WAYPOINT_TYPES.has(type)) return feature

    const kind = type === 'snapped-waypoint' && isOriginalOsmNode(lng, lat) ? 'edge' : 'mid'
    return { ...feature, properties: { ...feature.properties, kind } }
  })
  const numbered = assignWaypointClickIndices(features)

  if (onRoad) {
    const previewAlreadyShown = numbered.some((feature) => {
      if (feature.geometry?.type !== 'Point' || !feature.properties?.hovered) return false
      const [lng, lat] = feature.geometry.coordinates
      if (typeof lng !== 'number' || typeof lat !== 'number') return false
      return haversineMeters(onRoad.lat, onRoad.lon, lat, lng) < 2
    })
    if (!previewAlreadyShown) {
      numbered.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [onRoad.lon, onRoad.lat] },
        properties: { type: 'snap-preview', kind: 'mid', hovered: true },
      })
    }
  }

  return { ...geojson, features: numbered }
}

function isWaypointPoint(feature: Feature): feature is Feature<Point> {
  if (feature.geometry?.type !== 'Point') return false
  return WAYPOINT_TYPES.has(String(feature.properties?.type ?? ''))
}

function clickIndexForPoint(lon: number, lat: number, ordered: { lon: number; lat: number }[]) {
  for (const [index, waypoint] of ordered.entries()) {
    if (haversineMeters(lat, lon, waypoint.lat, waypoint.lon) <= CLICK_INDEX_MATCH_METERS) {
      return index + 1
    }
  }
  return null
}

/** 1-based click order along the confirmed route (start → end). */
function orderedClickWaypoints(features: Feature[]): { lon: number; lat: number }[] {
  const fromRoute = segmentsToWaypoints(
    normalizeRouteToolGeoJson({ type: 'FeatureCollection', features }),
  )
  if (fromRoute.length > 0) return fromRoute

  const confirmed: { lon: number; lat: number }[] = []
  const hovered: { lon: number; lat: number }[] = []
  for (const feature of features) {
    if (!isWaypointPoint(feature)) continue
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    const point = { lon: lng, lat }
    if (feature.properties?.hovered) hovered.push(point)
    else confirmed.push(point)
  }
  return confirmed.length > 0 ? confirmed : hovered
}

function assignWaypointClickIndices(features: Feature[]): Feature[] {
  const ordered = orderedClickWaypoints(features)
  return features.map((feature) => {
    if (!isWaypointPoint(feature)) return feature
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') return feature
    const clickIndex = clickIndexForPoint(lng, lat, ordered)
    if (clickIndex === null) return feature
    return { ...feature, properties: { ...feature.properties, click_index: clickIndex } }
  })
}
