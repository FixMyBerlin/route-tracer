import type { FeatureCollection } from 'geojson'
import { useEffect, useEffectEvent, useRef } from 'react'
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
import {
  configureRouteToolInteractions,
  setActiveRouteTool,
} from '@/shared/routing/route-tool-controller'
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

/**
 * Load existing segments into a fresh RouteTool.
 * Prefer `editExistingRoute` so renderGeojson includes waypoint/node Point handles.
 */
function restoreRouteOnTool(
  routeTool: RouteTool,
  segments: RouteSegment[] | undefined,
  skipPersistRef: ReturnType<typeof useSkipInitialRoutePersist>,
  setRouteToolGeoJson: (geojson: ReturnType<typeof segmentsToRouteToolGeoJson>) => void,
  setSegments: (segments: RouteSegment[]) => void,
) {
  if (!segments?.length) return false

  const hasManualSegments = segments.some((segment) => segment.segment_kind === 'manual')
  if (hasManualSegments) {
    // route-snapper editExistingRoute only restores waypoint endpoints, not dense freehand
    // LineStrings. Declarative layers keep the shared geometry; editing may re-snap on change.
    setRouteToolGeoJson(segmentsToRouteToolGeoJson(segments))
    setSegments(segments)
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
 *
 * Recreate the tool only when graph bytes change — not on segment edits or MapRef churn.
 * Recreating on segment updates wiped waypoint Points (handles) from the GeoJSON source.
 */
export function RouteSnapperHost() {
  const maps = useMap()
  const mapRef = maps[MAIN_MAP_ID]
  /** Stable MapLibre instance (MapRef identity from react-map-gl may churn). */
  const mapLibre = mapRef?.getMap() ?? null
  const graphBytes = useRouteSnapperGraphQuery().data?.graphBytes
  const urlSegments = useRouteUrlSegments()
  const storedSegments = useRouteSegments()
  const persistRouteSegments = usePersistRouteSegments()
  const skipPersistRef = useSkipInitialRoutePersist()
  const { setRouteToolGeoJson, setSegments, setSnapMode, setUndoLength } = useRouteActions()
  const routeToolRef = useRef<RouteTool | null>(null)
  const hydratedFromUrlRef = useRef(false)

  const segmentsToRestoreLatest = useEffectEvent(() => {
    return storedSegments.length > 0 ? storedSegments : urlSegments
  })

  const onRouteToolGeoJson = useEffectEvent((geojson: FeatureCollection) => {
    setRouteToolGeoJson(geojson)

    const segments = normalizeRouteToolGeoJson(geojson)
    setSegments(segments)
    if (skipPersistRef.current) {
      skipPersistRef.current = false
    } else {
      persistRouteSegments(segments)
    }
  })

  useEffect(
    function hydrateRouteFromUrl() {
      // Mark on first run even when URL has no route — otherwise our own persist
      // writing `?route=` would re-enter and wipe waypoint Points from the live tool.
      if (hydratedFromUrlRef.current) return
      hydratedFromUrlRef.current = true
      if (!urlSegments?.length) return

      // Lines only until RouteTool is ready; syncRouteToolGraph restores handles via editExisting.
      setRouteToolGeoJson(segmentsToRouteToolGeoJson(urlSegments))
      setSegments(urlSegments)
    },
    [urlSegments, setRouteToolGeoJson, setSegments],
  )

  useEffect(
    function syncRouteToolGraph() {
      if (!mapLibre || !graphBytes) return

      let cancelled = false

      void ensureRouteSnapperReady().then(() => {
        if (cancelled) return

        routeToolRef.current?.tearDown()
        const routeTool = new RouteTool(
          mapLibre,
          graphBytes,
          { set: onRouteToolGeoJson },
          { set: setSnapMode },
          { set: setUndoLength },
        )

        routeToolRef.current = routeTool
        configureRouteToolInteractions(routeTool)
        setActiveRouteTool(routeTool)

        if (
          !restoreRouteOnTool(
            routeTool,
            segmentsToRestoreLatest(),
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
        routeToolRef.current?.tearDown()
        routeToolRef.current = null
        setActiveRouteTool(null)
      }
    },
    // Recreate only when the MapLibre instance or graph bytes change.
    [
      graphBytes,
      mapLibre,
      setRouteToolGeoJson,
      setSegments,
      setSnapMode,
      setUndoLength,
      skipPersistRef,
    ],
  )

  useEffect(function resetHydrationFlagOnUnmount() {
    return () => {
      hydratedFromUrlRef.current = false
    }
  }, [])

  return null
}
