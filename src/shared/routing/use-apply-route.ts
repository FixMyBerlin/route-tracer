import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import { waypointsPreviewGeoJson } from '@/shared/routing/route-segments'
import { getRouteState, useRouteActions } from '@/shared/routing/route-store'
import { replaceActiveRoute } from '@/shared/routing/route-tool-controller'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { usePersistRoute } from '@/shared/routing/use-route-url-sync'

/** Make a whole new set of waypoints the route (auto-snap, an opened export) and go adjust it. */
export function useApplyRoute() {
  const actions = useRouteActions()
  const { updateSearch } = useIndexSearchNavigation()
  const persistRoute = usePersistRoute()

  return function applyRoute(waypoints: FlaggedWaypoint[]) {
    const previous = getRouteState().waypoints
    // Nothing from an earlier version of the route applies to this one.
    actions.setSavedSectionLengths(null)
    actions.setRouteChanges([])
    // Seed the flags first: the tool's redraw matches its points against them.
    actions.setWaypoints(waypoints)

    // On the adjust step the route tool is live: swap the route in place (undo brings the old
    // one back), and its redraw saves it to the URL.
    if (replaceActiveRoute(waypoints, previous)) return

    // Elsewhere the tool picks the waypoints up when the adjust step opens. Save them right
    // away, so a reload before the roads are loaded does not lose the route.
    actions.hydrateRoute(waypoints, null)
    actions.setRouteToolGeoJson(waypointsPreviewGeoJson(waypoints))
    persistRoute({ waypoints })
    updateSearch({ step: 'tracing' }, { replace: false })
  }
}
