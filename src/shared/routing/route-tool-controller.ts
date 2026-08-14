import type { FeatureCollection } from 'geojson'
import type { MapMouseEvent } from 'maplibre-gl'
import type { RouteTool } from 'route-snapper-ts'
import { clearRouteState, getRouteSnapMode } from '@/shared/routing/route-store'

let activeRouteTool: RouteTool | null = null
/** Last map cursor position in lon/lat — used so S updates the active line immediately. */
let lastPointerLonLat: [number, number] | null = null

export type RouteDrawMode = 'snapped' | 'freehand'

type RouteWaypoint = { lon: number; lat: number; snapped: boolean }

/** Convert a freehand end to a graph node when S re-enables snapping. */
const SNAP_CONVERT_METERS = 40

export function setActiveRouteTool(tool: RouteTool | null) {
  activeRouteTool = tool
  if (!tool) lastPointerLonLat = null
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusMeters = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
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

/** Confirmed waypoints from the live tool (works mid-draw). */
function readWaypoints(routeTool: RouteTool): RouteWaypoint[] {
  const raw = routeTool.inner.toFinalFeature()
  if (raw) {
    const feature = JSON.parse(raw) as {
      properties?: { waypoints?: RouteWaypoint[] }
    }
    if (Array.isArray(feature.properties?.waypoints) && feature.properties.waypoints.length > 0) {
      return feature.properties.waypoints
    }
  }

  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as FeatureCollection
  const confirmed: RouteWaypoint[] = []
  const hovered: RouteWaypoint[] = []
  for (const feature of geojson.features) {
    if (feature.geometry?.type !== 'Point') continue
    const type = feature.properties?.type
    if (type !== 'snapped-waypoint' && type !== 'free-waypoint') continue
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    const waypoint = { lon: lng, lat, snapped: type === 'snapped-waypoint' }
    if (feature.properties?.hovered) hovered.push(waypoint)
    else confirmed.push(waypoint)
  }
  return confirmed.length > 0 ? confirmed : hovered
}

function lastWaypointLonLat(routeTool: RouteTool): [number, number] | null {
  const last = readWaypoints(routeTool).at(-1)
  return last ? [last.lon, last.lat] : null
}

function applyPointer(routeTool: RouteTool, lonLat: [number, number] | null) {
  if (!lonLat) return
  const map = routeTool.map
  const point = map.project({ lng: lonLat[0], lat: lonLat[1] })
  const circleRadiusMeters = map.unproject(point).distanceTo(map.unproject([point.x - 30, point.y]))
  routeTool.inner.onMouseMove(lonLat[0], lonLat[1], circleRadiusMeters)
}

function restoreExtendRoute(routeTool: RouteTool) {
  routeTool.setRouteConfig({
    avoid_doubling_back: false,
    extend_route: true,
  })
}

function nearestSnappableNode(routeTool: RouteTool, lon: number, lat: number) {
  try {
    const geojson = JSON.parse(routeTool.inner.debugSnappableNodes()) as FeatureCollection
    let best: { lon: number; lat: number; dist: number } | null = null
    for (const feature of geojson.features) {
      if (feature.geometry?.type !== 'Point') continue
      const [lng, nodeLat] = feature.geometry.coordinates
      if (typeof lng !== 'number' || typeof nodeLat !== 'number') continue
      const dist = haversineMeters(lat, lon, nodeLat, lng)
      if (!best || dist < best.dist) best = { lon: lng, lat: nodeLat, dist }
    }
    return best
  } catch {
    return null
  }
}

/**
 * WASM only pathfinds between consecutive snapped waypoints. If the last click was
 * freehand but landed on the network, mark it snapped so the current line can follow roads.
 */
function convertLastFreeIfOnNetwork(routeTool: RouteTool) {
  const waypoints = readWaypoints(routeTool)
  const last = waypoints.at(-1)
  if (!last || last.snapped) return

  const nearest = nearestSnappableNode(routeTool, last.lon, last.lat)
  if (!nearest || nearest.dist > SNAP_CONVERT_METERS) return

  const next = waypoints.map((waypoint, index) =>
    index === waypoints.length - 1
      ? { lon: nearest.lon, lat: nearest.lat, snapped: true }
      : waypoint,
  )
  routeTool.inner.editExisting(next)
  restoreExtendRoute(routeTool)
}

function forceEnterSnapMode(routeTool: RouteTool) {
  applyPointer(routeTool, lastPointerLonLat ?? lastWaypointLonLat(routeTool))
  if (!readWasmSnapMode(routeTool)) {
    routeTool.toggleSnapMode()
  }
  if (!readWasmSnapMode(routeTool)) {
    applyPointer(routeTool, lastPointerLonLat ?? lastWaypointLonLat(routeTool))
    routeTool.toggleSnapMode()
  }

  convertLastFreeIfOnNetwork(routeTool)
  applyPointer(routeTool, lastPointerLonLat ?? lastWaypointLonLat(routeTool))
  syncRouteToolRender(routeTool)
}

function forceEnterFreehandMode(routeTool: RouteTool) {
  if (readWasmSnapMode(routeTool)) {
    routeTool.toggleSnapMode()
  }
  applyPointer(routeTool, lastPointerLonLat ?? lastWaypointLonLat(routeTool))
  syncRouteToolRender(routeTool)
}

/**
 * Route-snapper registers `s` / Enter on `keypress` and finishes on double-click.
 * We own mode switching via TanStack Hotkeys and keep the tool in continuous edit.
 */
export function configureRouteToolInteractions(routeTool: RouteTool) {
  restoreExtendRoute(routeTool)

  document.removeEventListener('keypress', routeTool.onKeyPress)
  const originalKeyPress = routeTool.onKeyPress.bind(routeTool)
  routeTool.onKeyPress = (event: KeyboardEvent) => {
    if (event.key === 's' || event.key === 'S') return
    if (event.key === 'Enter') {
      event.preventDefault()
      finishActiveRoute()
      return
    }
    originalKeyPress(event)
  }
  document.addEventListener('keypress', routeTool.onKeyPress)

  routeTool.map.off('dblclick', routeTool.onDoubleClick)
  routeTool.onDoubleClick = (event: MapMouseEvent) => {
    if (!routeTool.active) return
    event.preventDefault()
    finishActiveRoute()
  }

  const originalMouseMove = routeTool.onMouseMove.bind(routeTool)
  routeTool.map.off('mousemove', routeTool.onMouseMove)
  routeTool.onMouseMove = (event: MapMouseEvent) => {
    lastPointerLonLat = [event.lngLat.lng, event.lngLat.lat]
    originalMouseMove(event)
  }
  routeTool.map.on('mousemove', routeTool.onMouseMove)
}

export function toggleDrawThroughMode() {
  const routeTool = activeRouteTool
  if (!routeTool?.active) return

  const uiSnap = getRouteSnapMode()
  const lastIsFree = readWaypoints(routeTool).at(-1)?.snapped === false
  const nextMode: RouteDrawMode = uiSnap && lastIsFree ? 'snapped' : uiSnap ? 'freehand' : 'snapped'

  if (uiSnap && lastIsFree) {
    setRouteDrawMode('snapped')
    return
  }
  setRouteDrawMode(nextMode)
}

export function setRouteDrawMode(mode: RouteDrawMode) {
  const routeTool = activeRouteTool
  if (!routeTool?.active) return
  if (mode === 'snapped') {
    forceEnterSnapMode(routeTool)
    return
  }
  forceEnterFreehandMode(routeTool)
}

function stripHoverPreview(geojson: FeatureCollection): FeatureCollection {
  const hoveredEnds = new Set<string>()
  for (const feature of geojson.features) {
    if (feature.geometry?.type !== 'Point') continue
    if (!feature.properties?.hovered) continue
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng === 'number' && typeof lat === 'number') {
      hoveredEnds.add(`${lng},${lat}`)
    }
  }
  return {
    type: 'FeatureCollection',
    features: geojson.features.filter((feature) => {
      if (feature.properties?.hovered) return false
      if (feature.geometry?.type !== 'LineString') return true
      const end = feature.geometry.coordinates.at(-1)
      if (!end) return true
      return !hoveredEnds.has(`${end[0]},${end[1]}`)
    }),
  }
}

/** Confirm the route and leave drawing mode. Geometry stays on the map. */
export function finishActiveRoute() {
  const routeTool = activeRouteTool
  if (!routeTool?.active) return
  const confirmed = stripHoverPreview(
    JSON.parse(routeTool.inner.renderGeojson()) as FeatureCollection,
  )
  routeTool.active = false
  routeTool.inner.clearState()
  routeTool.routeToolGj.set(confirmed)
  routeTool.undoLength.set(0)
  routeTool.map.getCanvas().style.cursor = ''
  routeTool.map.boxZoom.enable()
  routeTool.map.doubleClickZoom.enable()
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
