import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { init as initRouteSnapper, RouteTool } from 'route-snapper-ts'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import {
  ROUTE_MANUAL_LAYER_ID,
  ROUTE_SNAPPED_LAYER_ID,
  ROUTE_TOOL_SOURCE_ID,
  ROUTE_WAYPOINT_LAYER_ID,
} from '@/shared/routing/route-layer-ids'
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

const emptyFeatureCollection: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

function ensureRouteLayers(map: MaplibreMap) {
  if (map.getSource(ROUTE_TOOL_SOURCE_ID)) return

  map.addSource(ROUTE_TOOL_SOURCE_ID, {
    type: 'geojson',
    data: emptyFeatureCollection,
  })

  map.addLayer({
    id: ROUTE_SNAPPED_LAYER_ID,
    source: ROUTE_TOOL_SOURCE_ID,
    type: 'line',
    filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'snapped'], true]],
    paint: {
      'line-color': '#38bdf8',
      'line-width': 5,
    },
  })

  map.addLayer({
    id: ROUTE_MANUAL_LAYER_ID,
    source: ROUTE_TOOL_SOURCE_ID,
    type: 'line',
    filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'snapped'], false]],
    paint: {
      'line-color': '#fb923c',
      'line-width': 5,
      'line-dasharray': [2, 1.5],
    },
  })

  map.addLayer({
    id: ROUTE_WAYPOINT_LAYER_ID,
    source: ROUTE_TOOL_SOURCE_ID,
    type: 'circle',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': '#e2e8f0',
      'circle-radius': 6,
      'circle-stroke-color': '#0f172a',
      'circle-stroke-width': 2,
    },
  })
}

function applyRouteSegmentsToMap(
  map: MaplibreMap,
  segments: RouteSegment[],
  setRouteToolGeoJson: (geojson: FeatureCollection) => void,
  setSegments: (segments: RouteSegment[]) => void,
) {
  const geojson = segmentsToRouteToolGeoJson(segments)
  setRouteToolGeoJson(geojson)
  const source = map.getSource(ROUTE_TOOL_SOURCE_ID) as GeoJSONSource | undefined
  source?.setData(geojson)
  setSegments(segments)
}

function restoreRouteOnTool(
  routeTool: RouteTool,
  segments: RouteSegment[] | undefined,
  skipPersistRef: ReturnType<typeof useSkipInitialRoutePersist>,
  map: MaplibreMap,
  setRouteToolGeoJson: (geojson: FeatureCollection) => void,
  setSegments: (segments: RouteSegment[]) => void,
) {
  if (!segments?.length) return false

  ensureRouteLayers(map)
  applyRouteSegmentsToMap(map, segments, setRouteToolGeoJson, setSegments)

  const hasManualSegments = segments.some((segment) => segment.segment_kind === 'manual')
  if (hasManualSegments) {
    // route-snapper editExistingRoute only restores waypoint endpoints, not dense freehand
    // LineStrings. Map layers above keep the shared geometry; editing may re-snap on change.
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
 * Keeps RouteTool warm once graph bytes exist, renders route layers, and syncs URL state.
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
              const source = map.getMap().getSource(ROUTE_TOOL_SOURCE_ID) as
                | GeoJSONSource
                | undefined
              source?.setData(geojson)

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
            map.getMap(),
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

  useEffect(
    function hydrateSharedRouteLayersFromUrl() {
      if (!map || !urlSegments?.length || hydratedFromUrlRef.current) return

      const mlMap = map.getMap()
      const hydrate = () => {
        ensureRouteLayers(mlMap)
        applyRouteSegmentsToMap(mlMap, urlSegments, setRouteToolGeoJson, setSegments)
        hydratedFromUrlRef.current = true
      }

      if (mlMap.isStyleLoaded()) {
        hydrate()
      } else {
        void mlMap.once('load', hydrate)
      }
    },
    [map, urlSegments, setRouteToolGeoJson, setSegments],
  )

  useEffect(
    function mountRouteLayers() {
      if (!map) return
      const mlMap = map.getMap()

      const setupLayers = () => {
        ensureRouteLayers(mlMap)
      }

      if (mlMap.isStyleLoaded()) {
        setupLayers()
      } else {
        void mlMap.once('load', setupLayers)
      }

      return () => {
        mlMap.off('load', setupLayers)
      }
    },
    [map],
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
