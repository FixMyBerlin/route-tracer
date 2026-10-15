import { splitLineAtWaypoints } from '@/shared/routing/auto-snap/split-at-waypoints'
import type { ReviewItem } from '@/shared/routing/review-item'
import { useRouteChanges, useRouteLine, useRouteWaypoints } from '@/shared/routing/route-store'

/** Stretches that came out different from the saved link, as review items for the map. */
export function useRouteChangeItems(): ReviewItem[] {
  const changes = useRouteChanges()
  const routeLine = useRouteLine()
  const waypoints = useRouteWaypoints()
  if (changes.length === 0) return []

  const sections = splitLineAtWaypoints(
    routeLine,
    waypoints.map((waypoint) => [waypoint.lon, waypoint.lat]),
  )
  return changes.map((change) => ({
    id: `c-${change.sectionIndex}`,
    kind: 'changed',
    title: `Was ${change.beforeMeters} m, now ${change.afterMeters} m`,
    coordinates: sections[change.sectionIndex] ?? [],
  }))
}
