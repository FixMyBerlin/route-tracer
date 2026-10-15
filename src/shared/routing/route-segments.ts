import type { Feature, FeatureCollection, GeoJsonProperties, LineString, Position } from 'geojson'
import { splitLineAtWaypoints } from '@/shared/routing/auto-snap/split-at-waypoints'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'

export type SegmentKind = 'snapped' | 'manual'

export type RouteSegment = {
  segment_index: number
  segment_kind: SegmentKind
  coordinates: Position[]
  osm_way_ids?: number[]
}

const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6

function roundPosition(position: Position): Position {
  const lng = position[0] ?? 0
  const lat = position[1] ?? 0
  return [roundCoord(lng), roundCoord(lat)]
}

function isLineStringFeature(feature: Feature): feature is Feature<LineString, GeoJsonProperties> {
  return feature.geometry.type === 'LineString'
}

/**
 * Extract snapped vs manual stretches from route-snapper's live GeoJSON.
 * Skips the speculative rubber band, which `decorateRouteToolGeoJson` marks as `preview`.
 */
export function normalizeRouteToolGeoJson(collection: FeatureCollection): RouteSegment[] {
  const segments: RouteSegment[] = []

  for (const feature of collection.features) {
    if (!isLineStringFeature(feature)) continue
    if (typeof feature.properties?.snapped !== 'boolean') continue
    if (feature.properties.preview === true) continue
    if (feature.geometry.coordinates.length < 2) continue

    segments.push({
      segment_index: segments.length,
      segment_kind: feature.properties.snapped ? 'snapped' : 'manual',
      coordinates: feature.geometry.coordinates.map(roundPosition),
    })
  }

  return segments
}

/** The whole route as one line, joining the stretches end to end. */
export function routeLineFromSegments(segments: RouteSegment[]): Position[] {
  const merged: Position[] = []

  for (const { coordinates } of segments) {
    for (const coordinate of coordinates) {
      const rounded = roundPosition(coordinate)
      const previous = merged.at(-1)
      if (previous && previous[0] === rounded[0] && previous[1] === rounded[1]) {
        continue
      }
      merged.push(rounded)
    }
  }

  return merged
}

/**
 * Waypoints that rebuild the given stretches. A snapped stretch only knows its two ends (the
 * clicks in between were merged into it); every vertex of a freehand stretch was a click.
 * Used to open links saved before the URL held waypoints.
 */
export function segmentsToFlaggedWaypoints(segments: RouteSegment[]): FlaggedWaypoint[] {
  const waypoints: FlaggedWaypoint[] = []

  const push = (position: Position | undefined, snapped: boolean) => {
    const lon = position?.[0]
    const lat = position?.[1]
    if (lon == null || lat == null) return
    const previous = waypoints.at(-1)
    if (previous && previous.lon === lon && previous.lat === lat) {
      // A stretch boundary: keep it snapped when either side snaps, so that side still routes.
      previous.snapped ||= snapped
      return
    }
    waypoints.push({ lon, lat, snapped, pinned: true })
  }

  for (const segment of segments) {
    if (segment.segment_kind === 'snapped') {
      push(segment.coordinates[0], true)
      push(segment.coordinates.at(-1), true)
      continue
    }
    for (const position of segment.coordinates) push(position, false)
  }

  return waypoints
}

/**
 * Stretches of a routed line: a section is snapped when both of its waypoints are (that is
 * how route-snapper routes), and neighbouring sections of the same kind join into one stretch.
 */
export function routeLineToSegments(
  line: Position[],
  waypoints: { lon: number; lat: number; snapped: boolean }[],
): RouteSegment[] {
  const sections = splitLineAtWaypoints(
    line,
    waypoints.map((waypoint) => [waypoint.lon, waypoint.lat]),
  )
  const segments: RouteSegment[] = []
  for (const [index, coordinates] of sections.entries()) {
    const kind: SegmentKind =
      waypoints[index]?.snapped && waypoints[index + 1]?.snapped ? 'snapped' : 'manual'
    const previous = segments.at(-1)
    if (previous?.segment_kind === kind) {
      previous.coordinates = routeLineFromSegments([previous, { ...previous, coordinates }])
      continue
    }
    if (coordinates.length < 2) continue
    segments.push({
      segment_index: segments.length,
      segment_kind: kind,
      coordinates: coordinates.map(roundPosition),
    })
  }
  return segments
}

/**
 * Stand-in drawing for a saved route whose roads are not loaded yet: straight lines between
 * its waypoints (`ghost`), plus the waypoints themselves.
 */
export function waypointsPreviewGeoJson(waypoints: FlaggedWaypoint[]): FeatureCollection {
  const line: Feature = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: waypoints.map((waypoint) => [waypoint.lon, waypoint.lat]),
    },
    properties: { ghost: true },
  }
  const points: Feature[] = waypoints.map((waypoint) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [waypoint.lon, waypoint.lat] },
    properties: { type: waypoint.snapped ? 'snapped-waypoint' : 'free-waypoint', kind: 'mid' },
  }))
  return { type: 'FeatureCollection', features: waypoints.length >= 2 ? [line, ...points] : points }
}

/** GeoJSON shape expected by route-snapper map layers (`snapped` property per LineString). */
export function segmentsToRouteToolGeoJson(segments: RouteSegment[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: segment.coordinates,
      },
      properties: {
        snapped: segment.segment_kind === 'snapped',
      },
    })),
  }
}
