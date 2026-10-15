import type { FeatureCollection } from 'geojson'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { init as initRouteSnapper, RouteTool } from 'route-snapper-ts'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { carryPinnedFlags } from '@/shared/routing/auto-snap/carry-pinned-flags'
import { coverageContainsAll } from '@/shared/routing/coverage-contains-point'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import { useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { diffSectionLengths } from '@/shared/routing/route-changes'
import { routeSearchStateFrom } from '@/shared/routing/route-search-state'
import {
  normalizeRouteToolGeoJson,
  routeLineFromSegments,
  waypointsPreviewGeoJson,
} from '@/shared/routing/route-segments'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'
import { getRouteState, useRouteActions } from '@/shared/routing/route-store'
import {
  configureRouteToolInteractions,
  readActiveRouteWaypoints,
  restoreActiveRoute,
  setActiveRouteTool,
  setRouteSnapperNetwork,
  syncRouteDrawMode,
} from '@/shared/routing/route-tool-controller'
import { usePersistRoute } from '@/shared/routing/use-route-url-sync'

let routeSnapperInitPromise: Promise<void> | undefined

async function ensureRouteSnapperReady() {
  if (!routeSnapperInitPromise) {
    routeSnapperInitPromise = initRouteSnapper().then(() => undefined)
  }
  await routeSnapperInitPromise
}

function sameWaypoints(a: FlaggedWaypoint[], b: FlaggedWaypoint[]) {
  return (
    a.length === b.length &&
    a.every((waypoint, index) => {
      const other = b[index]
      return (
        other != null &&
        waypoint.lon === other.lon &&
        waypoint.lat === other.lat &&
        waypoint.snapped === other.snapped &&
        waypoint.pinned === other.pinned
      )
    })
  )
}

/**
 * Keeps RouteTool warm once graph bytes exist and keeps the store and URL in step with it.
 * Route geometry is rendered declaratively by {@link RouteToolLayers}.
 *
 * The tool is recreated only when the graph changes (more roads loaded); the route moves over
 * by its waypoints.
 */
export function RouteSnapperHost() {
  const maps = useMap()
  const mapRef = maps[MAIN_MAP_ID]
  /** Stable MapLibre instance (MapRef identity from react-map-gl may churn). */
  const mapLibre = mapRef?.getMap() ?? null
  const graphQuery = useRouteSnapperGraphQuery()
  const graphBytes = graphQuery.data?.graphBytes
  const routingNetworkLatest = useEffectEvent(() => graphQuery.data?.routingNetwork ?? null)
  const coverage = useOsmCoverageQuery({ select: (data) => data.coverage })
  const coverageLatest = useEffectEvent(() => coverage.data)
  const persistRoute = usePersistRoute()
  const actions = useRouteActions()
  const { setRouteToolGeoJson, setSnapMode, setUndoLength } = actions
  const routeToolRef = useRef<RouteTool | null>(null)
  /** The next render is the first one of a route just loaded into the tool. */
  const justRestoredRef = useRef(false)
  /**
   * The waypoints last taken over from the tool. Compared against this rather than the store,
   * because undo and re-snap seed the store's flags before the tool redraws.
   */
  const syncedWaypointsRef = useRef<FlaggedWaypoint[]>([])

  const onRouteToolGeoJson = useEffectEvent((geojson: FeatureCollection) => {
    setRouteToolGeoJson(geojson)
    const segments = normalizeRouteToolGeoJson(geojson)
    actions.setSegments(segments)

    const live = readActiveRouteWaypoints()
    if (!live) return
    const state = getRouteState()
    const justRestored = justRestoredRef.current
    justRestoredRef.current = false

    // Right after loading, the tool hands back the same points, moved onto its graph nodes;
    // keep their flags by position in the list rather than by distance.
    const waypoints =
      justRestored && live.length === state.waypoints.length
        ? live.map((waypoint, index) => ({
            ...waypoint,
            pinned: state.waypoints[index]?.pinned ?? true,
          }))
        : carryPinnedFlags(state.waypoints, live, 1)
    if (!justRestored && sameWaypoints(waypoints, syncedWaypointsRef.current)) return

    syncedWaypointsRef.current = waypoints
    actions.setWaypoints(waypoints)
    actions.setRouteLine(routeLineFromSegments(segments))
    const route = routeSearchStateFrom(waypoints, segments)
    const { sectionLengths } = route

    if (justRestored) {
      // Compared once, on the first load from the link. A later reload (more roads loaded)
      // keeps whatever is still waiting for the user.
      const saved = state.savedSectionLengths
      const changes =
        saved && sectionLengths ? diffSectionLengths(saved, sectionLengths) : state.routeChanges
      if (saved) {
        actions.setSavedSectionLengths(null)
        actions.setRouteChanges(changes)
      }
      // Leave the link as it was saved until the user has looked at what changed.
      if (changes.length > 0) return
    } else if (state.routeChanges.length > 0) {
      // Editing the route is the user taking over from the saved version.
      actions.setRouteChanges([])
    }

    persistRoute(route)
  })

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
        setRouteSnapperNetwork(routingNetworkLatest())
        setActiveRouteTool(routeTool)

        const { waypoints } = getRouteState()
        if (waypoints.length === 0) {
          routeTool.startRoute()
        } else if (coverageContainsAll(coverageLatest(), waypoints)) {
          // route-snapper snaps a waypoint to the nearest road it knows, however far away, so a
          // saved route only goes in once the roads under all of its waypoints are loaded.
          justRestoredRef.current = true
          restoreActiveRoute(waypoints)
        } else {
          // Not started: nothing is drawn or saved until the roads along the route are loaded.
          // RoadsAlongLinePrompt offers loading them.
          setRouteToolGeoJson(waypointsPreviewGeoJson(waypoints))
        }
        syncRouteDrawMode()
      })

      return () => {
        cancelled = true
        routeToolRef.current?.tearDown()
        routeToolRef.current = null
        setActiveRouteTool(null)
        setRouteSnapperNetwork(null)
      }
    },
    // Recreate only when the MapLibre instance or graph bytes change.
    [actions, graphBytes, mapLibre, setRouteToolGeoJson, setSnapMode, setUndoLength],
  )

  return null
}
