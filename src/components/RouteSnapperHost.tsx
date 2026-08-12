import { useEffect, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { init as initRouteSnapper, RouteTool } from 'route-snapper-ts'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import type { RouteSegment } from '@/shared/routing/route-segments'
import {
  normalizeRouteToolGeoJson,
  segmentsToRouteFeature,
  segmentsToRouteToolGeoJson,
} from '@/shared/routing/route-segments'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'
import { useRouteActions, useRouteSegments } from '@/shared/routing/route-store'
import { setActiveRouteTool } from '@/shared/routing/route-tool-controller'
import {
  usePersistRouteSegments,
  useRouteUrlSegments,
  useSkipInitialRoutePersist,
} from '@/shared/routing/use-route-url-sync'

let routeSnapperInitPromise: Promise<void> | undefined

async function ensureRouteSnapperReady() {
  if (!routeSnapperInitPromise) {
    routeSnapperInitPromise = initRouteSnapper().then(() => undefined)
  }
  await routeSnapperInitPromise
}

function applyRouteSegmentsToStore(
  segments: RouteSegment[],
  setRouteToolGeoJson: (geojson: ReturnType<typeof segmentsToRouteToolGeoJson>) => void,
  setSegments: (segments: RouteSegment[]) => void,
) {
  setRouteToolGeoJson(segmentsToRouteToolGeoJson(segments))
  setSegments(segments)
}

function restoreRouteOnTool(
  routeTool: RouteTool,
  segments: RouteSegment[] | undefined,
  skipPersistRef: ReturnType<typeof useSkipInitialRoutePersist>,
  setRouteToolGeoJson: (geojson: ReturnType<typeof segmentsToRouteToolGeoJson>) => void,
  setSegments: (segments: RouteSegment[]) => void,
) {
  if (!segments?.length) return false

  applyRouteSegmentsToStore(segments, setRouteToolGeoJson, setSegments)

  const hasManualSegments = segments.some((segment) => segment.segment_kind === 'manual')
  if (hasManualSegments) {
    // route-snapper editExistingRoute only restores waypoint endpoints, not dense freehand
    // LineStrings. Declarative layers above keep the shared geometry; editing may re-snap on change.
    routeTool.startRoute()
    return true
  }

  const feature = segmentsToRouteFeature(segments)
  if (!feature) return false

  skipPersistRef.current = true
  routeTool.editExistingRoute(feature)
  return true
}

/**
 * Keeps RouteTool warm once graph bytes exist and syncs URL state.
 * Route geometry is rendered declaratively by {@link RouteToolLayers}.
 */
export function RouteSnapperHost() {
  const maps = useMap()
  const map = maps[MAIN_MAP_ID]
  const graphQuery = useRouteSnapperGraphQuery()
  const urlSegments = useRouteUrlSegments()
  const storedSegments = useRouteSegments()
  const persistRouteSegments = usePersistRouteSegments()
  const skipPersistRef = useSkipInitialRoutePersist()
  const { setRouteToolGeoJson, setSegments, setSnapMode, setUndoLength } = useRouteActions()
  const routeToolRef = useRef<RouteTool | null>(null)
  const hydratedFromUrlRef = useRef(false)

  useEffect(
    function hydrateRouteFromUrl() {
      if (!urlSegments?.length || hydratedFromUrlRef.current) return

      applyRouteSegmentsToStore(urlSegments, setRouteToolGeoJson, setSegments)
      hydratedFromUrlRef.current = true
    },
    [urlSegments, setRouteToolGeoJson, setSegments],
  )

  useEffect(
    function syncRouteToolGraph() {
      const graphBytes = graphQuery.data?.graphBytes
      if (!map || !graphBytes) return

      let cancelled = false

      void ensureRouteSnapperReady().then(() => {
        if (cancelled) return

        routeToolRef.current?.tearDown()
        const routeTool = new RouteTool(
          map.getMap(),
          graphBytes,
          {
            set: (geojson) => {
              setRouteToolGeoJson(geojson)

              const segments = normalizeRouteToolGeoJson(geojson)
              setSegments(segments)
              if (skipPersistRef.current) {
                skipPersistRef.current = false
              } else {
                persistRouteSegments(segments)
              }
            },
          },
          { set: setSnapMode },
          { set: setUndoLength },
        )

        routeToolRef.current = routeTool
        setActiveRouteTool(routeTool)

        const segmentsToRestore = storedSegments.length > 0 ? storedSegments : urlSegments
        if (
          !restoreRouteOnTool(
            routeTool,
            segmentsToRestore,
            skipPersistRef,
            setRouteToolGeoJson,
            setSegments,
          )
        ) {
          routeTool.startRoute()
        }
      })

      return () => {
        cancelled = true
      }
    },
    [
      graphQuery.data?.graphBytes,
      map,
      persistRouteSegments,
      setRouteToolGeoJson,
      setSegments,
      setSnapMode,
      setUndoLength,
      skipPersistRef,
      storedSegments,
      urlSegments,
    ],
  )

  useEffect(function teardownRouteTool() {
    return () => {
      routeToolRef.current?.tearDown()
      routeToolRef.current = null
      setActiveRouteTool(null)
      hydratedFromUrlRef.current = false
    }
  }, [])

  return null
}
