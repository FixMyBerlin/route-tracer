import simplify from '@turf/simplify'
import type { Feature, FeatureCollection, MultiLineString, MultiPoint, Position } from 'geojson'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import type { RouteSegment } from '@/shared/routing/route-segments'

/**
 * Douglas–Peucker tolerance in degrees (~0.5 m at mid-latitudes).
 * Strips densified / colinear vertices without changing the route's look.
 */
const ROUTE_EXPORT_SIMPLIFY_TOLERANCE = 0.000005

/** Marks the features this app adds next to the route stretches, so it can read its file back. */
const ROLE_WAYPOINTS = 'route-tracer:waypoints'
const ROLE_TRACK = 'route-tracer:source-track'

export type RouteExportOptions = {
  /** When true (default), simplify each segment LineString before download. */
  simplify?: boolean
  /** The decisions behind the route; with them the file can be opened and routed again. */
  waypoints?: FlaggedWaypoint[]
  /** The uploaded track the route was snapped from. */
  track?: { name: string; parts: Position[][] }
}

/**
 * One LineString per stretch (what most tools want), plus — when given — a MultiPoint with the
 * route's waypoints and a MultiLineString with the source track. Both are tagged with `role`.
 */
export function buildRouteExportGeoJson(
  segments: RouteSegment[],
  options: RouteExportOptions = {},
): FeatureCollection {
  const stretches: FeatureCollection = {
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: segment.coordinates },
      properties: {
        segment_index: segment.segment_index,
        segment_kind: segment.segment_kind,
        ...(segment.osm_way_ids?.length ? { osm_way_ids: segment.osm_way_ids } : {}),
      },
    })),
  }
  const collection =
    options.simplify === false
      ? stretches
      : simplify(stretches, {
          tolerance: ROUTE_EXPORT_SIMPLIFY_TOLERANCE,
          highQuality: true,
          // Clone: the features share their coordinate arrays with the route store.
          mutate: false,
        })

  const extras: Feature[] = []
  if (options.waypoints?.length) {
    extras.push({
      type: 'Feature',
      geometry: {
        type: 'MultiPoint',
        coordinates: options.waypoints.map((waypoint) => [waypoint.lon, waypoint.lat]),
      },
      properties: {
        role: ROLE_WAYPOINTS,
        waypoints: options.waypoints.map(({ lon, lat, snapped, pinned }) => ({
          lon,
          lat,
          snapped,
          pinned,
        })),
      },
    })
  }
  if (options.track) {
    extras.push({
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: options.track.parts },
      properties: { role: ROLE_TRACK, name: options.track.name },
    })
  }

  return { type: 'FeatureCollection', features: [...collection.features, ...extras] }
}

export type RouteExportContent = {
  waypoints: FlaggedWaypoint[]
  track?: { name: string; parts: Position[][] }
}

function isFlaggedWaypoint(value: unknown): value is FlaggedWaypoint {
  if (typeof value !== 'object' || value == null) return false
  const waypoint = value as FlaggedWaypoint
  return (
    Number.isFinite(waypoint.lon) &&
    Number.isFinite(waypoint.lat) &&
    typeof waypoint.snapped === 'boolean' &&
    typeof waypoint.pinned === 'boolean'
  )
}

/** The waypoints (and track) from a file this app exported, or null for any other file. */
export function readRouteExport(text: string): RouteExportContent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  const features = (parsed as Partial<FeatureCollection> | null)?.features
  if (!Array.isArray(features)) return null

  const waypointsFeature = features.find(
    (feature) => feature?.properties?.role === ROLE_WAYPOINTS,
  ) as Feature<MultiPoint> | undefined
  const waypoints: unknown = waypointsFeature?.properties?.waypoints
  if (!Array.isArray(waypoints) || waypoints.length === 0 || !waypoints.every(isFlaggedWaypoint)) {
    return null
  }

  const trackFeature = features.find((feature) => feature?.properties?.role === ROLE_TRACK) as
    | Feature<MultiLineString>
    | undefined
  const parts = trackFeature?.geometry?.coordinates
  return {
    waypoints,
    ...(Array.isArray(parts) && parts.length > 0
      ? { track: { name: String(trackFeature?.properties?.name ?? 'Track'), parts } }
      : {}),
  }
}

export function downloadRouteGeoJson(
  segments: RouteSegment[],
  options: RouteExportOptions & { filename?: string } = {},
) {
  const { filename = 'route.geojson', ...exportOptions } = options
  const geojson = buildRouteExportGeoJson(segments, exportOptions)
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Let the download start before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
