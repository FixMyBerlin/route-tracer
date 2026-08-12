import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useRef } from 'react'
import { Route } from '@/routes/index'
import type { RouteSegment } from '@/shared/routing/route-segments'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'

export function useRouteUrlSegments() {
  return Route.useSearch({ select: (search) => search.route })
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
    { wait: 300 },
  )
}

export function useClearRouteFromUrl() {
  const { updateSearch } = useIndexSearchNavigation()

  return () => {
    updateSearch({ route: undefined })
  }
}
