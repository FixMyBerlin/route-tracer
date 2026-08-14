import { haversineMeters } from '@/shared/routing/nearest-road-point'

export type MergeableWaypoint = { lon: number; lat: number; snapped: boolean }

/**
 * Dropping a point onto its neighbour leaves the stretch between them with nowhere to go, so
 * the two become one point. Only neighbours merge: two points that happen to meet elsewhere on
 * the route still stand for their own turn through it.
 *
 * A snapped point wins over a freehand one, because it is the one sitting on the road network
 * and the route can keep following roads through it.
 */
export function mergeAdjacentWaypoints(
  waypoints: MergeableWaypoint[],
  maxMeters: number,
): MergeableWaypoint[] {
  const merged: MergeableWaypoint[] = []

  for (const waypoint of waypoints) {
    const previous = merged.at(-1)
    if (
      previous &&
      haversineMeters(previous.lat, previous.lon, waypoint.lat, waypoint.lon) <= maxMeters
    ) {
      if (waypoint.snapped && !previous.snapped) merged[merged.length - 1] = waypoint
      continue
    }
    merged.push(waypoint)
  }

  return merged
}
