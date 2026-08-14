import { ROAD_SNAP_RADIUS_METERS } from '@/shared/routing/nearest-road-point'

export type SnapEndWaypoint = { lon: number; lat: number; snapped: boolean }

/** Closest node route-snapper can attach to, with its distance from the route end. */
export type SnapEndAnchor = { lon: number; lat: number; dist: number }

export type SnapEndResult = {
  waypoints: SnapEndWaypoint[]
  /** `moved` rewrote the freehand end, `bridged` added a graph node behind it. */
  change: 'none' | 'moved' | 'bridged'
}

/**
 * route-snapper only follows roads between two consecutive snapped waypoints, so a route
 * that ends on a freehand point needs a snapped end before snapping can continue there.
 *
 * A node right where the route ends (within {@link ROAD_SNAP_RADIUS_METERS}) takes over as
 * the end, so the next snapped stretch starts where the user stopped drawing. A node further
 * away is added behind the freehand end instead, so the freehand stretch keeps the point the
 * user clicked and simply runs on as a dashed bridge to where snapping can resume.
 *
 * Taking over the end is only safe while the point before it is freehand as well. With a
 * snapped point before it, the manual stretch the user just drew would be re-routed along
 * roads.
 */
export function withSnappedEnd(
  waypoints: SnapEndWaypoint[],
  anchor: SnapEndAnchor | null,
): SnapEndResult {
  const last = waypoints.at(-1)
  if (!last || last.snapped || !anchor) return { waypoints, change: 'none' }

  const snappedAnchor = { lon: anchor.lon, lat: anchor.lat, snapped: true }
  const previousIsFreehand = waypoints.at(-2)?.snapped !== true
  if (anchor.dist <= ROAD_SNAP_RADIUS_METERS && previousIsFreehand) {
    return { waypoints: [...waypoints.slice(0, -1), snappedAnchor], change: 'moved' }
  }
  return { waypoints: [...waypoints, snappedAnchor], change: 'bridged' }
}
