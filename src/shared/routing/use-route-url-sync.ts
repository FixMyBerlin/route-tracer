import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useNavigate } from '@tanstack/react-router'
import { useRef } from 'react'
import { Route } from '@/routes/index'
import { encodeRouteSearch } from '@/shared/routing/route-search-codec'
import type { RouteSegment } from '@/shared/routing/route-segments'
import { serializeIndexSearch } from '@/shared/routing/search-schema'

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
  const navigate = useNavigate({ from: Route.fullPath })

  return useDebouncedCallback(
    (segments: RouteSegment[]) => {
      void navigate({
        search: (prev) => ({
          ...serializeIndexSearch(prev),
          route: segments.length > 0 ? encodeRouteSearch(segments) : undefined,
        }),
        replace: true,
      })
    },
    { wait: 300 },
  )
}

export function useClearRouteFromUrl() {
  const navigate = useNavigate({ from: Route.fullPath })

  return () => {
    void navigate({
      search: (prev) => {
        const next = serializeIndexSearch(prev)
        delete next.route
        return next
      },
      replace: true,
    })
  }
}
