import { useEffect } from 'react'
import { coverageContainsAll } from '@/shared/routing/coverage-contains-point'
import { useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { getRouteEngine } from '@/shared/routing/route-engine'
import { routeLineToSegments, segmentsToRouteToolGeoJson } from '@/shared/routing/route-segments'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'
import { useRouteActions, useRouteSegments, useRouteWaypoints } from '@/shared/routing/route-store'

/**
 * A link opened straight on the export step never had the route tool draw it, so route its
 * waypoints here, without the map tool — once the roads under them are loaded.
 */
export function useRebuildRouteGeometry() {
  const waypoints = useRouteWaypoints()
  const segments = useRouteSegments()
  const graphBytes = useRouteSnapperGraphQuery().data?.graphBytes
  const coverage = useOsmCoverageQuery({ select: (data) => data.coverage })
  const { setSegments, setRouteLine, setRouteToolGeoJson } = useRouteActions()
  const needed = segments.length === 0 && waypoints.length >= 2
  const covered = coverageContainsAll(coverage.data, waypoints)

  useEffect(
    function rebuildRouteGeometry() {
      if (!needed || !graphBytes || !covered) return
      let cancelled = false
      void getRouteEngine(graphBytes).then((engine) => {
        if (cancelled) return
        const routed = engine.route(waypoints)
        if (!routed) return
        const rebuilt = routeLineToSegments(routed.coordinates, waypoints)
        setSegments(rebuilt)
        setRouteLine(routed.coordinates)
        setRouteToolGeoJson(segmentsToRouteToolGeoJson(rebuilt))
      })
      return () => {
        cancelled = true
      }
    },
    [needed, graphBytes, covered, waypoints, setSegments, setRouteLine, setRouteToolGeoJson],
  )

  return { waitingForRoads: needed && !covered }
}
