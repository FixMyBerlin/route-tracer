import type { FeatureCollection, LineString } from 'geojson'
import type { MapMouseEvent } from 'maplibre-gl'
import type { RouteTool } from 'route-snapper-ts'
import { decorateRouteToolGeoJson } from '@/shared/routing/decorate-route-tool-geojson'
import {
  insertIndexAlongSegments,
  insertWaypointAt,
  isNearExistingWaypoint,
} from '@/shared/routing/insert-route-waypoint'
import {
  ROAD_SNAP_RADIUS_METERS,
  haversineMeters,
  nearestPointOnLines,
} from '@/shared/routing/nearest-road-point'
import { pickRouteEndToResume, waypointsStartingFromEnd } from '@/shared/routing/resume-route-end'
import { normalizeRouteToolGeoJson } from '@/shared/routing/route-segments'
import { clearRouteState, getRouteSnapMode } from '@/shared/routing/route-store'

export type RouteDrawMode = 'snapped' | 'freehand'

type RouteWaypoint = { lon: number; lat: number; snapped: boolean }

let activeRouteTool: RouteTool | null = null
/** Last map cursor position in lon/lat — used so S updates the active line immediately. */
let lastPointerLonLat: [number, number] | null = null
/** Confirmed waypoints kept after finish so an endpoint click can resume drawing. */
let inactiveRouteWaypoints: RouteWaypoint[] | null = null
let routeSnapperNetwork: FeatureCollection<LineString> | null = null

/** Matches route-snapper-ts hover/click radius. */
const SNAP_DISTANCE_PIXELS = 30

/** Convert a freehand end to a graph node when S re-enables snapping. */
const SNAP_CONVERT_METERS = 40

export function setActiveRouteTool(tool: RouteTool | null) {
  activeRouteTool = tool
  if (!tool) {
    lastPointerLonLat = null
    inactiveRouteWaypoints = null
  }
}

export function setRouteSnapperNetwork(network: FeatureCollection<LineString> | null) {
  routeSnapperNetwork = network
}

function syncRouteToolRender(routeTool: RouteTool) {
  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as FeatureCollection & {
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

function snapRadiusMeters(routeTool: RouteTool, lonLat: [number, number]) {
  const point = routeTool.map.project({ lng: lonLat[0], lat: lonLat[1] })
  return routeTool.map
    .unproject(point)
    .distanceTo(routeTool.map.unproject([point.x - SNAP_DISTANCE_PIXELS, point.y]))
}

function applyPointer(routeTool: RouteTool, lonLat: [number, number] | null) {
  if (!lonLat) return
  routeTool.inner.onMouseMove(lonLat[0], lonLat[1], snapRadiusMeters(routeTool, lonLat))
}

function restoreExtendRoute(routeTool: RouteTool) {
  routeTool.setRouteConfig({
    avoid_doubling_back: false,
    extend_route: true,
  })
}

function readHoveredPoint(routeTool: RouteTool) {
  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as FeatureCollection
  for (const feature of geojson.features) {
    if (feature.geometry?.type !== 'Point' || !feature.properties?.hovered) continue
    const [lng, lat] = feature.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    return { lon: lng, lat, type: String(feature.properties.type ?? '') }
  }
  return null
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
  if (!last || last.snapped) {
    return { converted: false, dist: null as number | null }
  }

  const nearest = nearestSnappableNode(routeTool, last.lon, last.lat)
  if (!nearest || nearest.dist > SNAP_CONVERT_METERS) {
    return { converted: false, dist: nearest?.dist ?? null }
  }

  const next = waypoints.map((waypoint, index) =>
    index === waypoints.length - 1
      ? { lon: nearest.lon, lat: nearest.lat, snapped: true }
      : waypoint,
  )
  routeTool.inner.editExisting(next)
  restoreExtendRoute(routeTool)
  return { converted: true, dist: nearest.dist }
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

function commitWaypoints(routeTool: RouteTool, waypoints: RouteWaypoint[], stayFreehand: boolean) {
  routeTool.inner.editExisting(waypoints)
  restoreExtendRoute(routeTool)
  if (stayFreehand) {
    forceEnterFreehandMode(routeTool)
    return
  }
  applyPointer(routeTool, lastPointerLonLat ?? lastWaypointLonLat(routeTool))
  syncRouteToolRender(routeTool)
}

function handleRouteClick(routeTool: RouteTool, originalOnClick: () => void) {
  const pointer = lastPointerLonLat
  const hover = readHoveredPoint(routeTool)
  const waypoints = readWaypoints(routeTool)
  const stayFreehand = !getRouteSnapMode()

  if (
    hover &&
    (hover.type === 'snapped-waypoint' || hover.type === 'free-waypoint') &&
    pointer &&
    haversineMeters(pointer[1], pointer[0], hover.lat, hover.lon) <= ROAD_SNAP_RADIUS_METERS
  ) {
    originalOnClick()
    return
  }

  if (!pointer) {
    originalOnClick()
    return
  }

  const [clickLon, clickLat] = pointer
  const confirmed = normalizeRouteToolGeoJson(
    JSON.parse(routeTool.inner.renderGeojson()) as FeatureCollection,
  )
  const onDrawnRoute = insertIndexAlongSegments(
    confirmed.map((segment) => segment.coordinates),
    clickLon,
    clickLat,
  )
  const onRoad = routeSnapperNetwork
    ? nearestPointOnLines(routeSnapperNetwork, clickLon, clickLat)
    : null

  if (onDrawnRoute) {
    const segment = confirmed[onDrawnRoute.segmentIndex]
    const snapOnSegment = !stayFreehand && segment?.segment_kind === 'snapped'
    let placeLon = onDrawnRoute.lon
    let placeLat = onDrawnRoute.lat
    let snapped = false
    if (snapOnSegment) {
      const node = nearestSnappableNode(routeTool, onDrawnRoute.lon, onDrawnRoute.lat)
      if (node) {
        placeLon = node.lon
        placeLat = node.lat
        snapped = true
      }
    }
    if (isNearExistingWaypoint(waypoints, placeLon, placeLat)) {
      originalOnClick()
      return
    }
    commitWaypoints(
      routeTool,
      insertWaypointAt(waypoints, onDrawnRoute.insertIndex, {
        lon: placeLon,
        lat: placeLat,
        snapped,
      }),
      stayFreehand,
    )
    return
  }

  if (onRoad) {
    if (isNearExistingWaypoint(waypoints, onRoad.lon, onRoad.lat)) {
      originalOnClick()
      return
    }
    if (stayFreehand) {
      commitWaypoints(
        routeTool,
        [...waypoints, { lon: onRoad.lon, lat: onRoad.lat, snapped: false }],
        true,
      )
      return
    }
    routeTool.addSnappedWaypoint([onRoad.lon, onRoad.lat])
    restoreExtendRoute(routeTool)
    applyPointer(routeTool, pointer)
    return
  }

  if (stayFreehand) {
    originalOnClick()
    return
  }
}

/**
 * Route-snapper registers `s` / Enter on `keypress` and finishes on double-click.
 * We own mode switching via TanStack Hotkeys. Double-click finishes; clicking an
 * endpoint resumes drawing from that end.
 */
export function configureRouteToolInteractions(routeTool: RouteTool) {
  restoreExtendRoute(routeTool)

  const originalGjSet = routeTool.routeToolGj.set.bind(routeTool.routeToolGj)
  routeTool.routeToolGj.set = (geojson) => {
    if (geojson.type !== 'FeatureCollection') {
      originalGjSet(geojson)
      return
    }
    originalGjSet(
      decorateRouteToolGeoJson(
        geojson,
        routeTool.active ? lastPointerLonLat : null,
        routeSnapperNetwork,
      ),
    )
  }

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
    // Double-click is [click, click, dblclick]. Undo the extra click so the
    // last vertex is the finish location, then leave drawing mode.
    routeTool.undo()
    finishActiveRoute()
  }
  routeTool.map.on('dblclick', routeTool.onDoubleClick)

  const originalMouseMove = routeTool.onMouseMove.bind(routeTool)
  routeTool.map.off('mousemove', routeTool.onMouseMove)
  routeTool.onMouseMove = (event: MapMouseEvent) => {
    lastPointerLonLat = [event.lngLat.lng, event.lngLat.lat]
    originalMouseMove(event)
    if (!routeTool.active) {
      updateInactiveCursor(routeTool)
      return
    }
    if (!routeSnapperNetwork) return
    const onRoad = nearestPointOnLines(routeSnapperNetwork, event.lngLat.lng, event.lngLat.lat)
    if (onRoad) syncRouteToolRender(routeTool)
  }
  routeTool.map.on('mousemove', routeTool.onMouseMove)

  const originalOnClick = routeTool.onClick.bind(routeTool)
  routeTool.map.off('click', routeTool.onClick)
  routeTool.onClick = (event?: MapMouseEvent) => {
    if (event?.lngLat) lastPointerLonLat = [event.lngLat.lng, event.lngLat.lat]
    if (!routeTool.active) {
      tryResumeFromEndpoint(routeTool)
      return
    }
    handleRouteClick(routeTool, originalOnClick)
  }
  routeTool.map.on('click', routeTool.onClick)
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
      if (feature.properties?.type === 'snap-preview') return false
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
  inactiveRouteWaypoints = readWaypoints(routeTool)
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

function updateInactiveCursor(routeTool: RouteTool) {
  const pointer = lastPointerLonLat
  if (!pointer || !inactiveRouteWaypoints?.length) {
    routeTool.map.getCanvas().style.cursor = ''
    return
  }
  const end = pickRouteEndToResume(
    inactiveRouteWaypoints,
    pointer[0],
    pointer[1],
    snapRadiusMeters(routeTool, pointer),
  )
  routeTool.map.getCanvas().style.cursor = end ? 'pointer' : ''
}

function tryResumeFromEndpoint(routeTool: RouteTool) {
  const waypoints = inactiveRouteWaypoints
  const pointer = lastPointerLonLat
  if (!waypoints?.length || !pointer) return
  const end = pickRouteEndToResume(
    waypoints,
    pointer[0],
    pointer[1],
    snapRadiusMeters(routeTool, pointer),
  )
  if (!end) return
  resumeActiveRoute(routeTool, waypointsStartingFromEnd(waypoints, end))
}

function resumeActiveRoute(routeTool: RouteTool, waypoints: RouteWaypoint[]) {
  inactiveRouteWaypoints = null
  routeTool.startRoute()
  routeTool.inner.editExisting(waypoints)
  restoreExtendRoute(routeTool)
  if (getRouteSnapMode()) {
    forceEnterSnapMode(routeTool)
    return
  }
  forceEnterFreehandMode(routeTool)
}

export function undoRouteEdit() {
  activeRouteTool?.undo()
}

export function clearActiveRoute() {
  inactiveRouteWaypoints = null
  if (!activeRouteTool) {
    clearRouteState()
    return
  }
  activeRouteTool.stop()
  clearRouteState()
  activeRouteTool.startRoute()
  syncRouteToolRender(activeRouteTool)
}
