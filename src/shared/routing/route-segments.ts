import simplify from '@turf/simplify'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  Point,
  Position,
} from 'geojson'
import type { RouteProps } from 'route-snapper-ts'

export type SegmentKind = 'snapped' | 'manual'

export type RouteSegment = {
  segment_index: number
  segment_kind: SegmentKind
  coordinates: Position[]
  osm_way_ids?: number[]
}

/**
 * Douglas–Peucker tolerance in degrees (~1 m at mid-latitudes).
 * Strips densified / colinear vertices without changing the route's look.
 */
const ROUTE_EXPORT_SIMPLIFY_TOLERANCE = 0.00001

export type RouteExportOptions = {
  /** When true (default), simplify each segment LineString before download. */
  simplify?: boolean
}

const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6

function roundPosition(position: Position): Position {
  const lng = position[0] ?? 0
  const lat = position[1] ?? 0
  return [roundCoord(lng), roundCoord(lat)]
}

function positionKey(position: Position): string {
  const [lng, lat] = roundPosition(position)
  return `${lng},${lat}`
}

function isLineStringFeature(feature: Feature): feature is Feature<LineString, GeoJsonProperties> {
  return feature.geometry.type === 'LineString'
}

function isPointFeature(feature: Feature): feature is Feature<Point, GeoJsonProperties> {
  return feature.geometry.type === 'Point'
}

/**
 * Extract snapped vs manual stretches from route-snapper's live GeoJSON.
 * Skips speculative rubber-band LineStrings that end on a hovered cursor point.
 */
export function normalizeRouteToolGeoJson(collection: FeatureCollection): RouteSegment[] {
  const hoveredEnds = new Set<string>()
  for (const feature of collection.features) {
    if (!isPointFeature(feature)) continue
    if (!feature.properties?.hovered) continue
    hoveredEnds.add(positionKey(feature.geometry.coordinates))
  }

  const segments: RouteSegment[] = []

  for (const feature of collection.features) {
    if (!isLineStringFeature(feature)) continue
    if (typeof feature.properties?.snapped !== 'boolean') continue
    if (feature.geometry.coordinates.length < 2) continue

    const end = feature.geometry.coordinates.at(-1)
    if (end && hoveredEnds.has(positionKey(end))) continue

    segments.push({
      segment_index: segments.length,
      segment_kind: feature.properties.snapped ? 'snapped' : 'manual',
      coordinates: feature.geometry.coordinates.map(roundPosition),
    })
  }

  return segments
}

export function mergeSegmentCoordinates(segmentCoords: Position[][]): Position[] {
  const merged: Position[] = []

  for (const coordinates of segmentCoords) {
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

export function segmentsToRouteFeature(
  segments: RouteSegment[],
): Feature<LineString, RouteProps> | null {
  if (segments.length === 0) return null

  const coordinates = mergeSegmentCoordinates(segments.map((segment) => segment.coordinates))
  if (coordinates.length < 2) return null

  const waypoints = segmentsToWaypoints(segments)
  const lengthMeters = estimateLengthMeters(coordinates)

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {
      waypoints,
      length_meters: lengthMeters,
      route_name: 'Shared route',
      full_path: [],
    },
  }
}

export function segmentsToWaypoints(segments: RouteSegment[]) {
  const waypoints: RouteProps['waypoints'] = []

  const first = segments[0]?.coordinates[0]
  if (!first) return waypoints

  waypoints.push({
    lon: first[0] ?? 0,
    lat: first[1] ?? 0,
    snapped: segments[0]!.segment_kind === 'snapped',
  })

  for (const segment of segments) {
    const end = segment.coordinates.at(-1)
    if (!end) continue
    waypoints.push({
      lon: end[0] ?? 0,
      lat: end[1] ?? 0,
      snapped: segment.segment_kind === 'snapped',
    })
  }

  return waypoints
}

function estimateLengthMeters(coordinates: Position[]) {
  let length = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1]
    const current = coordinates[index]
    if (!previous || !current) continue
    const [lng1, lat1] = previous
    const [lng2, lat2] = current
    length += haversineMeters(lat1 ?? 0, lng1 ?? 0, lat2 ?? 0, lng2 ?? 0)
  }
  return Math.round(length)
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusMeters = 6_371_000
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
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

export function buildRouteExportGeoJson(
  segments: RouteSegment[],
  options: RouteExportOptions = {},
): FeatureCollection {
  const shouldSimplify = options.simplify !== false

  const collection: FeatureCollection = {
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: segment.coordinates,
      },
      properties: {
        segment_index: segment.segment_index,
        segment_kind: segment.segment_kind,
        ...(segment.osm_way_ids?.length ? { osm_way_ids: segment.osm_way_ids } : {}),
      },
    })),
  }

  if (!shouldSimplify) return collection

  return simplify(collection, {
    tolerance: ROUTE_EXPORT_SIMPLIFY_TOLERANCE,
    highQuality: true,
    mutate: true,
  })
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
  URL.revokeObjectURL(url)
}
