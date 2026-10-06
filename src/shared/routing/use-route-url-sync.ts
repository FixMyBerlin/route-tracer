import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useEffect, useRef } from 'react'
import { Route } from '@/routes/index'
import type { RouteSegment } from '@/shared/routing/route-segments'
import { segmentsToRouteToolGeoJson } from '@/shared/routing/route-segments'
import { useRouteActions } from '@/shared/routing/route-store'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'

export function useRouteUrlSegments() {
  return Route.useSearch({ select: (search) => search.route })
}

/**
 * Seed the route store from a shared link, once. Runs for every step, so the export step can
 * download a route the tracing step never loaded.
 *
 * Lines only: the route tool restores the draggable points when tracing starts.
 */
export function useHydrateRouteFromUrl() {
  const urlSegments = useRouteUrlSegments()
  const { setRouteToolGeoJson, setSegments } = useRouteActions()
  const hydratedRef = useRef(false)

  useEffect(
    function hydrateRouteFromUrl() {
      // Mark on first run even when the URL has no route — otherwise our own persist
      // writing `?route=` would re-enter and wipe waypoint Points from the live tool.
      if (hydratedRef.current) return
      hydratedRef.current = true
      if (!urlSegments?.length) return

      setRouteToolGeoJson(segmentsToRouteToolGeoJson(urlSegments))
      setSegments(urlSegments)
    },
    [urlSegments, setRouteToolGeoJson, setSegments],
  )
}

/** Skip the first GeoJSON-driven persist after hydrating a shared route link. */
export function useSkipInitialRoutePersist() {
  const urlSegments = useRouteUrlSegments()
  const skipRef = useRef(urlSegments != null && urlSegments.length > 0)
  return skipRef
}

export function usePersistRouteSegments() {
  const { updateSearch } = useIndexSearchNavigation()

  return useDebouncedCallback(
    (segments: RouteSegment[]) => {
      updateSearch({ route: segments.length > 0 ? segments : undefined })
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
