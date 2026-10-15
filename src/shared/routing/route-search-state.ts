import { sectionLengthsMeters } from '@/shared/routing/auto-snap/split-at-waypoints'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import type { RouteSearchState } from '@/shared/routing/route-search-codec'
import { routeLineFromSegments, type RouteSegment } from '@/shared/routing/route-segments'

/** What goes into the URL for a route: its waypoints plus the length of each section. */
export function routeSearchStateFrom(
  waypoints: FlaggedWaypoint[],
  segments: RouteSegment[],
): RouteSearchState {
  if (waypoints.length < 2) return { waypoints }
  return {
    waypoints,
    sectionLengths: sectionLengthsMeters(
      routeLineFromSegments(segments),
      waypoints.map((waypoint) => [waypoint.lon, waypoint.lat]),
    ),
  }
}
