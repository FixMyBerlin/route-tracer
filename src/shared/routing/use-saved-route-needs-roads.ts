import { useOsmStorageReady } from '@/shared/map/map-chrome-store'
import { coverageContainsAll } from '@/shared/routing/coverage-contains-point'
import { useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { useRouteWaypoints } from '@/shared/routing/route-store'

/** The route from the link cannot be routed yet: some of its points have no roads loaded. */
export function useSavedRouteNeedsRoads() {
  const waypoints = useRouteWaypoints()
  const storageReady = useOsmStorageReady()
  const coverage = useOsmCoverageQuery({ select: (data) => data.coverage })
  return storageReady && waypoints.length > 0 && !coverageContainsAll(coverage.data, waypoints)
}
