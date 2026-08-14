import type { Position } from 'geojson'
import {
  ROAD_SNAP_RADIUS_METERS,
  haversineMeters,
  linesFromCoordinates,
  nearestPointOnLines,
} from '@/shared/routing/nearest-road-point'

export type InsertableWaypoint = { lon: number; lat: number; snapped: boolean }

export type SegmentInsertTarget = {
  /** Waypoint list index to insert at (after the segment start). */
  insertIndex: number
  segmentIndex: number
  lon: number
  lat: number
}

/**
 * Where to insert a waypoint so it splits the confirmed segment the click
 * landed on. `null` when the click is not on the drawn route.
 */
export function insertIndexAlongSegments(
  segmentCoords: Position[][],
  lon: number,
  lat: number,
  maxMeters = ROAD_SNAP_RADIUS_METERS,
): SegmentInsertTarget | null {
  const found = nearestPointOnLines(linesFromCoordinates(segmentCoords), lon, lat, maxMeters)
  if (!found) return null
  return {
    insertIndex: found.featureIndex + 1,
    segmentIndex: found.featureIndex,
    lon: found.lon,
    lat: found.lat,
  }
}

export function isNearExistingWaypoint(
  waypoints: InsertableWaypoint[],
  lon: number,
  lat: number,
  maxMeters = 2,
) {
  return waypoints.some(
    (waypoint) => haversineMeters(lat, lon, waypoint.lat, waypoint.lon) <= maxMeters,
  )
}

export function insertWaypointAt(
  waypoints: InsertableWaypoint[],
  index: number,
  waypoint: InsertableWaypoint,
): InsertableWaypoint[] {
  return [...waypoints.slice(0, index), waypoint, ...waypoints.slice(index)]
}
