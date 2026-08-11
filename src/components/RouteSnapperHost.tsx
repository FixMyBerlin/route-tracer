import type { GeoJSON } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { init as initRouteSnapper, RouteTool } from 'route-snapper-ts'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'

let routeSnapperInitPromise: Promise<void> | undefined

async function ensureRouteSnapperReady() {
  if (!routeSnapperInitPromise) {
    routeSnapperInitPromise = initRouteSnapper().then(() => undefined)
  }
  await routeSnapperInitPromise
}

/**
 * Keeps a RouteTool/JsRouteSnapper instance warm once graph bytes are available.
 * Drawing stays inactive until Phase 4 calls startRoute().
 */
export function RouteSnapperHost() {
  const maps = useMap()
  const map = maps[MAIN_MAP_ID]
  const graphQuery = useRouteSnapperGraphQuery()
  const routeToolRef = useRef<RouteTool | null>(null)
  const [routeToolGj, setRouteToolGj] = useState<GeoJSON>({
    type: 'FeatureCollection',
    features: [],
  })
  const [snapMode, setSnapMode] = useState(false)
  const [undoLength, setUndoLength] = useState(0)

  useEffect(
    function syncRouteToolGraph() {
      const graphBytes = graphQuery.data?.graphBytes
      if (!map || !graphBytes) return

      let cancelled = false

      void ensureRouteSnapperReady().then(() => {
        if (cancelled) return

        routeToolRef.current?.tearDown()
        routeToolRef.current = new RouteTool(
          map.getMap(),
          graphBytes,
          { set: setRouteToolGj },
          { set: setSnapMode },
          { set: setUndoLength },
        )
      })

      return () => {
        cancelled = true
      }
    },
    [graphQuery.data?.graphBytes, map],
  )

  useEffect(function teardownRouteTool() {
    return () => {
      routeToolRef.current?.tearDown()
      routeToolRef.current = null
    }
  }, [])

  void routeToolGj
  void snapMode
  void undoLength

  return null
}
