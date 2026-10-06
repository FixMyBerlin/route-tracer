import simplify from '@turf/simplify'
import type { Feature, FeatureCollection, GeoJsonProperties, LineString, Position } from 'geojson'
import type { RouteProps } from 'route-snapper-ts'
import { pathLengthMeters } from '@/shared/routing/haversine'

export type SegmentKind = 'snapped' | 'manual'

export type RouteSegment = {
  segment_index: number
  segment_kind: SegmentKind
  coordinates: Position[]
  osm_way_ids?: number[]
}

/**
 * Douglas–Peucker tolerance in degrees (~0.5 m at mid-latitudes).
 * Strips densified / colinear vertices without changing the route's look.
 */
const ROUTE_EXPORT_SIMPLIFY_TOLERANCE = 0.000005

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

function mergeSegmentCoordinates(segmentCoords: Position[][]): Position[] {
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
  const lengthMeters = Math.round(pathLengthMeters(coordinates))

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
    // Clone: the features share their coordinate arrays with the route store.
    mutate: false,
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
  // Let the download start before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
