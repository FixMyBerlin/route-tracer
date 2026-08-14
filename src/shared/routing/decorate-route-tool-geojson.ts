import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson'
import { isOriginalOsmNode } from '@/shared/routing/densify-osm-for-snapping'
import { haversineMeters, nearestPointOnLines } from '@/shared/routing/nearest-road-point'
import { normalizeRouteToolGeoJson, segmentsToWaypoints } from '@/shared/routing/route-segments'

const WAYPOINT_TYPES = new Set(['snapped-waypoint', 'free-waypoint'])
const CLICK_INDEX_MATCH_METERS = 2
/** route-snapper trims exported waypoints, so a route end never matches one exactly. */
const WAYPOINT_SAME_PLACE_METERS = 0.5

export type ClickWaypoint = { lon: number; lat: number }

/**
 * Tag confirmed waypoints as graph-node (`edge`) vs mid-block/free (`mid`), mark the
 * rubber-band stretch as `preview`, and add a preview point on the nearest road when the
 * cursor is within 5 m.
 *
 * `waypoints` are route-snapper's own confirmed waypoints, in route order.
 */
export function decorateRouteToolGeoJson(
  geojson: FeatureCollection,
  pointer: [number, number] | null,
  network: FeatureCollection<LineString> | null,
  waypoints: ClickWaypoint[] = [],
): FeatureCollection {
  const onRoad = pointer && network ? nearestPointOnLines(network, pointer[0], pointer[1]) : null

  const features = markPreviewLines(geojson.features, waypoints).map((feature) => {
    if (feature.geometry?.type !== 'Point') return feature
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') return feature

    const type = String(feature.properties?.type ?? '')
    if (!WAYPOINT_TYPES.has(type)) return feature

    const kind = type === 'snapped-waypoint' && isOriginalOsmNode(lng, lat) ? 'edge' : 'mid'
    return { ...feature, properties: { ...feature.properties, kind } }
  })
  const numbered = assignWaypointClickIndices(features, waypoints)

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

function samePlace(position: Position | undefined, waypoint: ClickWaypoint) {
  const [lng, lat] = position ?? []
  if (typeof lng !== 'number' || typeof lat !== 'number') return false
  return haversineMeters(lat, lng, waypoint.lat, waypoint.lon) <= WAYPOINT_SAME_PLACE_METERS
}

/**
 * route-snapper emits the confirmed route first, as stretches that run waypoint to waypoint,
 * and then the stretch it would append next — as single graph edges, which can happen to end on
 * a waypoint too. So walk the chain from the first waypoint instead of judging lines one by one:
 * everything past the last waypoint is the preview.
 */
function markPreviewLines(features: Feature[], waypoints: ClickWaypoint[]): Feature[] {
  if (waypoints.length === 0) return features

  let reached = 0
  return features.map((feature) => {
    if (feature.geometry?.type !== 'LineString') return feature

    const { coordinates } = feature.geometry
    const next = waypoints.findIndex(
      (waypoint, index) => index > reached && samePlace(coordinates.at(-1), waypoint),
    )
    if (next !== -1 && samePlace(coordinates[0], waypoints[reached]!)) {
      reached = next
      return feature
    }
    return { ...feature, properties: { ...feature.properties, preview: true } }
  })
}

function isWaypointPoint(feature: Feature): feature is Feature<Point> {
  if (feature.geometry?.type !== 'Point') return false
  return WAYPOINT_TYPES.has(String(feature.properties?.type ?? ''))
}

function clickIndexForPoint(lon: number, lat: number, ordered: ClickWaypoint[]) {
  for (const [index, waypoint] of ordered.entries()) {
    if (haversineMeters(lat, lon, waypoint.lat, waypoint.lon) <= CLICK_INDEX_MATCH_METERS) {
      return index + 1
    }
  }
  return null
}

/** 1-based click order along the confirmed route (start → end). */
function orderedClickWaypoints(features: Feature[], waypoints: ClickWaypoint[]): ClickWaypoint[] {
  if (waypoints.length > 0) return waypoints

  const fromRoute = segmentsToWaypoints(
    normalizeRouteToolGeoJson({ type: 'FeatureCollection', features }),
  )
  if (fromRoute.length > 0) return fromRoute

  const confirmed: ClickWaypoint[] = []
  const hovered: ClickWaypoint[] = []
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

function assignWaypointClickIndices(features: Feature[], waypoints: ClickWaypoint[]): Feature[] {
  const ordered = orderedClickWaypoints(features, waypoints)
  return features.map((feature) => {
    if (!isWaypointPoint(feature)) return feature
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') return feature
    const clickIndex = clickIndexForPoint(lng, lat, ordered)
    if (clickIndex === null) return feature
    return { ...feature, properties: { ...feature.properties, click_index: clickIndex } }
  })
}
