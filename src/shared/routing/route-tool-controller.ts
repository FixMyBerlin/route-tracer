import type { FeatureCollection, Point } from 'geojson'
import type { MapMouseEvent } from 'maplibre-gl'
import type { RouteTool } from 'route-snapper-ts'
import { clearRouteState } from '@/shared/routing/route-store'

let activeRouteTool: RouteTool | null = null

export type RouteDrawMode = 'snapped' | 'freehand'

export function setActiveRouteTool(tool: RouteTool | null) {
  activeRouteTool = tool
}

function syncRouteToolRender(routeTool: RouteTool) {
  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as {
    cursor?: string
    snap_mode?: boolean
    undo_length?: number
  }
  routeTool.routeToolGj.set(geojson)
  if (typeof geojson.cursor === 'string') {
    routeTool.map.getCanvas().style.cursor = geojson.cursor
  }
  if (typeof geojson.snap_mode === 'boolean') {
    routeTool.snapMode.set(geojson.snap_mode)
  }
  if (typeof geojson.undo_length === 'number') {
    routeTool.undoLength.set(geojson.undo_length)
  }
}

function readWasmSnapMode(routeTool: RouteTool): boolean {
  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as { snap_mode?: boolean }
  return geojson.snap_mode === true
}

/** Last confirmed waypoint from the live tool GeoJSON (works mid-draw). */
function lastWaypointLonLat(routeTool: RouteTool): [number, number] | null {
  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as FeatureCollection
  let last: [number, number] | null = null
  for (const feature of geojson.features) {
    if (feature.geometry?.type !== 'Point') continue
    const type = feature.properties?.type
    if (type !== 'snapped-waypoint' && type !== 'free-waypoint') continue
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng === 'number' && typeof lat === 'number') {
      last = [lng, lat]
    }
  }
  return last
}

function nearestSnappableNode(
  routeTool: RouteTool,
  near: [number, number] | null,
): [number, number] | null {
  const collection = JSON.parse(routeTool.inner.debugSnappableNodes()) as FeatureCollection<Point>
  const features = collection.features
  if (features.length === 0) return null

  if (!near) {
    const coords = features[0]?.geometry?.coordinates
    const lng = coords?.[0]
    const lat = coords?.[1]
    return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : null
  }

  let best: [number, number] | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const feature of features) {
    const coords = feature.geometry?.coordinates
    const lng = coords?.[0]
    const lat = coords?.[1]
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    const dist = (lng - near[0]) ** 2 + (lat - near[1]) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = [lng, lat]
    }
  }
  return best
}

/**
 * route-snapper's toggleSnapMode may fail when leaving freehand: WASM only
 * enters snap if mouseover_node succeeds at the current Freehand cursor.
 * With extend_route, that cursor is often nowhere near a graph node.
 */
function prepareForSnapToggle(routeTool: RouteTool) {
  const node = nearestSnappableNode(routeTool, lastWaypointLonLat(routeTool))
  if (!node) return
  routeTool.inner.onMouseMove(node[0], node[1], 50)
}

/**
 * Route-snapper registers `s` / Enter on `keypress` and finishes on double-click.
 * We own mode switching via TanStack Hotkeys and keep the tool in continuous edit
 * (no Enter / double-click finish — that wiped WASM state mid-draw).
 */
export function configureRouteToolInteractions(routeTool: RouteTool) {
  routeTool.setRouteConfig({
    avoid_doubling_back: false,
    extend_route: true,
  })

  document.removeEventListener('keypress', routeTool.onKeyPress)
  const originalKeyPress = routeTool.onKeyPress.bind(routeTool)
  routeTool.onKeyPress = (event: KeyboardEvent) => {
    if (event.key === 's' || event.key === 'S') return
    if (event.key === 'Enter') return
    originalKeyPress(event)
  }
  document.addEventListener('keypress', routeTool.onKeyPress)

  routeTool.map.off('dblclick', routeTool.onDoubleClick)
  routeTool.onDoubleClick = (event: MapMouseEvent) => {
    if (!routeTool.active) return
    // Default tool finishes (and clears) on dblclick. Keep editing instead.
    event.preventDefault()
  }
}

export function toggleDrawThroughMode() {
  const routeTool = activeRouteTool
  if (!routeTool?.active) return
  setRouteDrawMode(readWasmSnapMode(routeTool) ? 'freehand' : 'snapped')
}

/** Set draw mode explicitly; no-ops when already in that mode. */
export function setRouteDrawMode(mode: RouteDrawMode) {
  const routeTool = activeRouteTool
  if (!routeTool?.active) return

  const wantSnap = mode === 'snapped'
  if (readWasmSnapMode(routeTool) === wantSnap) {
    syncRouteToolRender(routeTool)
    return
  }

  if (wantSnap) {
    prepareForSnapToggle(routeTool)
  }

  routeTool.toggleSnapMode()

  // Retry once if WASM silently rolled snap_mode back.
  if (wantSnap && !readWasmSnapMode(routeTool)) {
    prepareForSnapToggle(routeTool)
    routeTool.toggleSnapMode()
  }

  syncRouteToolRender(routeTool)
}

export function undoRouteEdit() {
  activeRouteTool?.undo()
}

export function clearActiveRoute() {
  if (!activeRouteTool) {
    clearRouteState()
    return
  }
  activeRouteTool.stop()
  clearRouteState()
  activeRouteTool.startRoute()
  syncRouteToolRender(activeRouteTool)
}
