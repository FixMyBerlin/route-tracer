import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useEffect, useRef } from 'react'
import { Route } from '@/routes/index'
import type { RouteSearchState } from '@/shared/routing/route-search-codec'
import { waypointsPreviewGeoJson } from '@/shared/routing/route-segments'
import { useRouteActions } from '@/shared/routing/route-store'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'

function useRouteUrlState() {
  return Route.useSearch({ select: (search) => search.route })
}

/**
 * Seed the route store from a shared link, once. Runs for every step, so the export step can
 * rebuild a route the tracing step never loaded.
 *
 * Only the waypoints: the geometry comes from routing them once the roads are loaded. Until
 * then a straight stand-in line shows where the route goes.
 */
export function useHydrateRouteFromUrl() {
  const urlRoute = useRouteUrlState()
  const { hydrateRoute, setRouteToolGeoJson } = useRouteActions()
  const hydratedRef = useRef(false)

  useEffect(
    function hydrateRouteFromUrl() {
      // Mark on first run even when the URL has no route, so our own writes never re-enter.
      if (hydratedRef.current) return
      hydratedRef.current = true
      if (!urlRoute?.waypoints.length) return

      hydrateRoute(urlRoute.waypoints, urlRoute.sectionLengths ?? null)
      setRouteToolGeoJson(waypointsPreviewGeoJson(urlRoute.waypoints))
    },
    [urlRoute, hydrateRoute, setRouteToolGeoJson],
  )
}

export function usePersistRoute() {
  const { updateSearch } = useIndexSearchNavigation()

  return useDebouncedCallback(
    (route: RouteSearchState) => {
      updateSearch({ route: route.waypoints.length > 0 ? route : undefined })
    },
    // Leaving the tracing step right after an edit must still write that edit to the URL.
    { wait: 300, onUnmount: (debouncer) => debouncer.flush() },
  )
}

export function useClearRouteFromUrl() {
  const { updateSearch } = useIndexSearchNavigation()

  return () => {
    updateSearch({ route: undefined })
  }
}
