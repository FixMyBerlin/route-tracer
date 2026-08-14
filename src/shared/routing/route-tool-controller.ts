import type { FeatureCollection, LineString } from 'geojson'
import type { MapMouseEvent } from 'maplibre-gl'
import type { RouteTool } from 'route-snapper-ts'
import { ROUTE_WAYPOINT_RADIUS_PX } from '@/shared/routing/constants'
import { decorateRouteToolGeoJson } from '@/shared/routing/decorate-route-tool-geojson'
import {
  insertIndexAlongSegments,
  insertWaypointAt,
  isNearExistingWaypoint,
} from '@/shared/routing/insert-route-waypoint'
import { mergeAdjacentWaypoints } from '@/shared/routing/merge-route-waypoints'
import {
  ROAD_SNAP_RADIUS_METERS,
  haversineMeters,
  nearestPointOnLines,
} from '@/shared/routing/nearest-road-point'
import { pickRouteEndToResume, waypointsStartingFromEnd } from '@/shared/routing/resume-route-end'
import { normalizeRouteToolGeoJson } from '@/shared/routing/route-segments'
import { clearRouteState, setRouteSnapModeState } from '@/shared/routing/route-store'
import { withSnappedEnd, type SnapEndResult } from '@/shared/routing/snap-route-end'

export type RouteDrawMode = 'snapped' | 'freehand'

type RouteWaypoint = { lon: number; lat: number; snapped: boolean }

let activeRouteTool: RouteTool | null = null
/** Last map cursor position in lon/lat — used so S updates the active line immediately. */
let lastPointerLonLat: [number, number] | null = null
/**
 * A finished route stays loaded in route-snapper so its points can still be dragged;
 * only appending new points is switched off.
 */
let routeFinished = false
let routeSnapperNetwork: FeatureCollection<LineString> | null = null
/**
 * The mode the user picked. route-snapper keeps its own snap flag and flips it on
 * every drag, so the app has to own this and push it back into WASM.
 */
let drawMode: RouteDrawMode = 'snapped'

/** Matches route-snapper-ts hover/click radius. */
const SNAP_DISTANCE_PIXELS = 30

export function setActiveRouteTool(tool: RouteTool | null) {
  activeRouteTool = tool
  routeFinished = false
  if (!tool) lastPointerLonLat = null
}

export function setRouteSnapperNetwork(network: FeatureCollection<LineString> | null) {
  routeSnapperNetwork = network
}

/**
 * route-snapper draws the stretch it would append next just like a confirmed one, so the
 * decorator needs its waypoints to tell them apart.
 */
function decorateForRender(routeTool: RouteTool, geojson: FeatureCollection) {
  return decorateRouteToolGeoJson(
    geojson,
    routeFinished ? null : lastPointerLonLat,
    routeSnapperNetwork,
    readWaypoints(routeTool),
  )
}

function readConfirmedSegments(routeTool: RouteTool) {
  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as FeatureCollection
  return normalizeRouteToolGeoJson(decorateForRender(routeTool, geojson))
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

/** route-snapper reports the grab cursor for as long as a point is being dragged. */
function isDraggingWaypoint(routeTool: RouteTool): boolean {
  const geojson = JSON.parse(routeTool.inner.renderGeojson()) as { cursor?: string }
  return geojson.cursor === 'grabbing'
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

function pixelsInMeters(routeTool: RouteTool, lonLat: [number, number], pixels: number) {
  const point = routeTool.map.project({ lng: lonLat[0], lat: lonLat[1] })
  return routeTool.map
    .unproject(point)
    .distanceTo(routeTool.map.unproject([point.x - pixels, point.y]))
}

function snapRadiusMeters(routeTool: RouteTool, lonLat: [number, number]) {
  return pixelsInMeters(routeTool, lonLat, SNAP_DISTANCE_PIXELS)
}

function applyPointer(routeTool: RouteTool, lonLat: [number, number] | null) {
  if (!lonLat) return
  routeTool.inner.onMouseMove(lonLat[0], lonLat[1], snapRadiusMeters(routeTool, lonLat))
}

/**
 * `extend_route` is what separates drawing from editing: with it off route-snapper stops
 * previewing a next point and only hovers points already on the route, so they stay draggable.
 */
function restoreExtendRoute(routeTool: RouteTool) {
  routeTool.setRouteConfig({
    avoid_doubling_back: false,
    extend_route: !routeFinished,
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
 * Fold a point that was dropped onto its neighbour into that neighbour.
 *
 * "On top of each other" is what the user sees, so the distance follows the drawn waypoint
 * circle — capped, because at low zoom that circle covers far more ground than a drop gesture.
 */
function mergeDroppedWaypoint(routeTool: RouteTool) {
  const waypoints = readWaypoints(routeTool)
  const anchor = lastPointerLonLat ?? lastWaypointLonLat(routeTool)
  if (waypoints.length < 2 || !anchor) return

  const merged = mergeAdjacentWaypoints(
    waypoints,
    Math.min(pixelsInMeters(routeTool, anchor, ROUTE_WAYPOINT_RADIUS_PX), ROAD_SNAP_RADIUS_METERS),
  )
  if (merged.length === waypoints.length) return

  routeTool.inner.editExisting(merged)
  restoreExtendRoute(routeTool)
  applyPointer(routeTool, lastPointerLonLat)
}

/** Resolve the graph node a freehand route end can continue snapping from. */
function snapEndAnchor(routeTool: RouteTool, waypoints: RouteWaypoint[]): SnapEndResult {
  const last = waypoints.at(-1)
  if (!last || last.snapped) return { waypoints, change: 'none' }
  return withSnappedEnd(waypoints, nearestSnappableNode(routeTool, last.lon, last.lat))
}

/**
 * Hand a freehand end that stopped on a graph node over to snapping right away, so the preview
 * line already shows the road the next click will follow. An end further from the graph needs a
 * bridge waypoint, which we only add once the user actually clicks.
 */
function snapRouteEndOnRoad(routeTool: RouteTool) {
  const anchored = snapEndAnchor(routeTool, readWaypoints(routeTool))
  if (anchored.change !== 'moved') return
  routeTool.inner.editExisting(anchored.waypoints)
  restoreExtendRoute(routeTool)
}

/** Toggle the WASM snap flag until it agrees with {@link drawMode}. */
function applyDrawModeToWasm(routeTool: RouteTool) {
  const wantSnapped = drawMode === 'snapped'
  const pointer = () => lastPointerLonLat ?? lastWaypointLonLat(routeTool)
  applyPointer(routeTool, pointer())
  if (readWasmSnapMode(routeTool) !== wantSnapped) {
    routeTool.toggleSnapMode()
  }
  // Entering snap mode fails while the cursor is not on a node yet, so try once more.
  if (readWasmSnapMode(routeTool) !== wantSnapped) {
    applyPointer(routeTool, pointer())
    routeTool.toggleSnapMode()
  }
  applyPointer(routeTool, pointer())
}

function forceEnterSnapMode(routeTool: RouteTool) {
  applyDrawModeToWasm(routeTool)
  snapRouteEndOnRoad(routeTool)
  applyPointer(routeTool, lastPointerLonLat ?? lastWaypointLonLat(routeTool))
  syncRouteToolRender(routeTool)
}

function forceEnterFreehandMode(routeTool: RouteTool) {
  applyDrawModeToWasm(routeTool)
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
  const stayFreehand = drawMode === 'freehand'

  // route-snapper also marks the point it would add next as hovered. Hand the click over
  // only for a point that is already part of the route, where clicking removes it again.
  if (
    hover &&
    (hover.type === 'snapped-waypoint' || hover.type === 'free-waypoint') &&
    isNearExistingWaypoint(waypoints, hover.lon, hover.lat) &&
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
  const confirmed = readConfirmedSegments(routeTool)
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

  if (stayFreehand) {
    // A freehand click within 5 m of a road sticks to it, so snapping can pick up there later.
    if (!onRoad || isNearExistingWaypoint(waypoints, onRoad.lon, onRoad.lat)) {
      originalOnClick()
      return
    }
    commitWaypoints(
      routeTool,
      [...waypoints, { lon: onRoad.lon, lat: onRoad.lat, snapped: false }],
      true,
    )
    return
  }

  // Snapped clicks only land on the network.
  if (!onRoad) return
  if (isNearExistingWaypoint(waypoints, onRoad.lon, onRoad.lat)) {
    originalOnClick()
    return
  }

  const anchored = snapEndAnchor(routeTool, waypoints)
  if (anchored.change !== 'none') {
    routeTool.inner.editExisting(anchored.waypoints)
    restoreExtendRoute(routeTool)
  }
  routeTool.addSnappedWaypoint([onRoad.lon, onRoad.lat])
  restoreExtendRoute(routeTool)
  applyPointer(routeTool, pointer)
  syncRouteToolRender(routeTool)
}

/**
 * Route-snapper registers `s` / Enter on `keypress` and finishes on double-click.
 * We own mode switching via TanStack Hotkeys. Double-click finishes; clicking an
 * endpoint resumes drawing from that end.
 */
export function configureRouteToolInteractions(routeTool: RouteTool) {
  restoreExtendRoute(routeTool)

  // Every redraw would otherwise publish the WASM snap flag, which a drag silently rewrites.
  const originalSnapModeSet = routeTool.snapMode.set.bind(routeTool.snapMode)
  routeTool.snapMode.set = () => {
    originalSnapModeSet(drawMode === 'snapped')
  }

  const originalGjSet = routeTool.routeToolGj.set.bind(routeTool.routeToolGj)
  routeTool.routeToolGj.set = (geojson) => {
    if (geojson.type !== 'FeatureCollection') {
      originalGjSet(geojson)
      return
    }
    originalGjSet(decorateForRender(routeTool, geojson))
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
    if (!routeTool.active || routeFinished) return
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
    // A finished route has no snap preview to follow the cursor; route-snapper's own
    // redraw already switches the cursor over the points that stay draggable.
    if (!routeTool.active || routeFinished || !routeSnapperNetwork) return
    const onRoad = nearestPointOnLines(routeSnapperNetwork, event.lngLat.lng, event.lngLat.lat)
    if (onRoad) syncRouteToolRender(routeTool)
  }
  routeTool.map.on('mousemove', routeTool.onMouseMove)

  // Dragging a waypoint puts route-snapper into the mode of the point being dragged.
  // Restore the mode the user picked so the next click still draws what the sidebar says.
  const originalMouseUp = routeTool.onMouseUp.bind(routeTool)
  routeTool.map.off('mouseup', routeTool.onMouseUp)
  routeTool.onMouseUp = () => {
    const dropped = isDraggingWaypoint(routeTool)
    originalMouseUp()
    if (!routeTool.active) return
    if (dropped) mergeDroppedWaypoint(routeTool)
    // route-snapper leaves the grab cursor behind because it does not redraw here.
    if (routeFinished || readWasmSnapMode(routeTool) === (drawMode === 'snapped')) {
      syncRouteToolRender(routeTool)
      return
    }
    applyDrawModeToWasm(routeTool)
    syncRouteToolRender(routeTool)
  }
  routeTool.map.on('mouseup', routeTool.onMouseUp)

  const originalOnClick = routeTool.onClick.bind(routeTool)
  routeTool.map.off('click', routeTool.onClick)
  routeTool.onClick = (event?: MapMouseEvent) => {
    if (event?.lngLat) lastPointerLonLat = [event.lngLat.lng, event.lngLat.lat]
    if (!routeTool.active) return
    if (routeFinished) {
      handleFinishedClick(routeTool, originalOnClick)
      return
    }
    handleRouteClick(routeTool, originalOnClick)
  }
  routeTool.map.on('click', routeTool.onClick)
}

export function toggleDrawThroughMode() {
  setRouteDrawMode(drawMode === 'snapped' ? 'freehand' : 'snapped')
}

export function setRouteDrawMode(mode: RouteDrawMode) {
  drawMode = mode
  setRouteSnapModeState(mode === 'snapped')

  // A finished route picks the mode up again when drawing resumes from one of its ends.
  const routeTool = activeRouteTool
  if (!routeTool?.active || routeFinished) return
  if (mode === 'snapped') {
    forceEnterSnapMode(routeTool)
    return
  }
  forceEnterFreehandMode(routeTool)
}

/**
 * A fresh or reloaded tool always starts out snapping, so push the picked mode back in
 * after the graph was rebuilt or a shared route was restored.
 */
export function syncRouteDrawMode() {
  const routeTool = activeRouteTool
  if (!routeTool?.active || routeFinished) return
  applyDrawModeToWasm(routeTool)
  syncRouteToolRender(routeTool)
}

/**
 * Confirm the route: it stops growing, but stays loaded so every point can still be dragged
 * and either end can pick drawing up again. `editExisting` re-seeds the same waypoints to drop
 * the half-drawn stretch that was following the cursor.
 */
export function finishActiveRoute() {
  const routeTool = activeRouteTool
  if (!routeTool?.active || routeFinished) return
  const waypoints = readWaypoints(routeTool)
  if (waypoints.length < 2) return

  routeFinished = true
  routeTool.inner.editExisting(waypoints)
  restoreExtendRoute(routeTool)
  applyPointer(routeTool, lastPointerLonLat)
  syncRouteToolRender(routeTool)
  routeTool.map.boxZoom.enable()
  routeTool.map.doubleClickZoom.enable()
}

/**
 * A finished route takes two kinds of click: its ends pick drawing up again, and any other
 * point on it is deleted. route-snapper only ever hovers points that are on the route while
 * the route is finished, so a click anywhere else is a no-op.
 */
function handleFinishedClick(routeTool: RouteTool, originalOnClick: () => void) {
  if (tryResumeFromEndpoint(routeTool)) return
  originalOnClick()
  // One point left is a route being drawn again, not a finished one.
  if (readWaypoints(routeTool).length >= 2) return
  routeFinished = false
  restoreExtendRoute(routeTool)
  syncRouteToolRender(routeTool)
}

function tryResumeFromEndpoint(routeTool: RouteTool) {
  const pointer = lastPointerLonLat
  if (!pointer) return false
  const waypoints = readWaypoints(routeTool)
  if (waypoints.length === 0) return false
  const end = pickRouteEndToResume(
    waypoints,
    pointer[0],
    pointer[1],
    snapRadiusMeters(routeTool, pointer),
  )
  if (!end) return false
  resumeActiveRoute(routeTool, waypointsStartingFromEnd(waypoints, end))
  return true
}

function resumeActiveRoute(routeTool: RouteTool, waypoints: RouteWaypoint[]) {
  routeFinished = false
  // Resuming from the start means drawing on a reversed route, so re-seed the waypoints.
  routeTool.inner.editExisting(waypoints)
  restoreExtendRoute(routeTool)
  routeTool.map.boxZoom.disable()
  routeTool.map.doubleClickZoom.disable()
  if (drawMode === 'snapped') {
    forceEnterSnapMode(routeTool)
    return
  }
  forceEnterFreehandMode(routeTool)
}

export function undoRouteEdit() {
  activeRouteTool?.undo()
}

export function clearActiveRoute() {
  routeFinished = false
  if (!activeRouteTool) {
    clearRouteState()
    return
  }
  activeRouteTool.stop()
  clearRouteState()
  activeRouteTool.startRoute()
  applyDrawModeToWasm(activeRouteTool)
  syncRouteToolRender(activeRouteTool)
}
