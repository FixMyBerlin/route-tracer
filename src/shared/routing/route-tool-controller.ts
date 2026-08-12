import type { MapMouseEvent } from 'maplibre-gl'
import type { RouteTool } from 'route-snapper-ts'
import { clearRouteState, getRouteSnapMode } from '@/shared/routing/route-store'

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
  activeRouteTool?.toggleSnapMode()
}

/** Set draw mode explicitly; no-ops when already in that mode. */
export function setRouteDrawMode(mode: RouteDrawMode) {
  const wantSnap = mode === 'snapped'
  if (getRouteSnapMode() === wantSnap) return
  activeRouteTool?.toggleSnapMode()
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
