import nearestPointOnLine from '@turf/nearest-point-on-line'
import type { FeatureCollection, LineString, Position } from 'geojson'

/** Click/hover must be this close to a road (or the drawn route) to snap onto it. */
export const ROAD_SNAP_RADIUS_METERS = 5

/** ~20 m in degrees at mid-latitudes — prefilter edges before Turf. */
const SEARCH_PAD_DEGREES = 0.0002

export type NearestLinePoint = {
  lon: number
  lat: number
  distMeters: number
  featureIndex: number
}

function asMeters(properties: { pointDistance?: number; dist?: number } | null | undefined) {
  const meters = properties?.pointDistance ?? properties?.dist
  return typeof meters === 'number' && Number.isFinite(meters) ? meters : Number.POSITIVE_INFINITY
}

function lineBboxHits(
  coordinates: Position[],
  lon: number,
  lat: number,
  padDegrees: number,
): boolean {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const coord of coordinates) {
    const lineLon = coord[0]
    const lineLat = coord[1]
    if (typeof lineLon !== 'number' || typeof lineLat !== 'number') continue
    minLon = Math.min(minLon, lineLon)
    minLat = Math.min(minLat, lineLat)
    maxLon = Math.max(maxLon, lineLon)
    maxLat = Math.max(maxLat, lineLat)
  }
  return (
    lon >= minLon - padDegrees &&
    lon <= maxLon + padDegrees &&
    lat >= minLat - padDegrees &&
    lat <= maxLat + padDegrees
  )
}

/**
 * Project a click onto the nearest LineString. Returns null when nothing is
 * within {@link maxMeters} (default 5 m).
 */
export function nearestPointOnLines(
  lines: FeatureCollection<LineString>,
  lon: number,
  lat: number,
  maxMeters = ROAD_SNAP_RADIUS_METERS,
): NearestLinePoint | null {
  let best: NearestLinePoint | null = null

  for (const [featureIndex, feature] of lines.features.entries()) {
    if (feature.geometry.type !== 'LineString') continue
    const coordinates = feature.geometry.coordinates
    if (coordinates.length < 2) continue
    if (!lineBboxHits(coordinates, lon, lat, SEARCH_PAD_DEGREES)) continue

    const snapped = nearestPointOnLine(feature.geometry, [lon, lat], { units: 'meters' })
    const distMeters = asMeters(snapped.properties)
    if (distMeters > maxMeters) continue
    const [snapLon, snapLat] = snapped.geometry.coordinates
    if (typeof snapLon !== 'number' || typeof snapLat !== 'number') continue
    if (!best || distMeters < best.distMeters) {
      best = { lon: snapLon, lat: snapLat, distMeters, featureIndex }
    }
  }

  return best
}

export function linesFromCoordinates(paths: Position[][]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: paths
      .filter((coordinates) => coordinates.length >= 2)
      .map((coordinates) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })),
  }
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusMeters = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
}
