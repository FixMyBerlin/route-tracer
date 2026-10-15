import type { FeatureCollection, Position } from 'geojson'
import { create } from 'zustand'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import type { RouteSegment } from '@/shared/routing/route-segments'

const emptyRouteToolGeoJson: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

/** A stretch between two waypoints whose length changed since the route was saved. */
export type RouteSectionChange = {
  sectionIndex: number
  beforeMeters: number
  afterMeters: number
}

type RouteStore = {
  /** The route's decisions — what the URL stores. */
  waypoints: FlaggedWaypoint[]
  /** Section lengths the URL was saved with; compared once the route is rebuilt, then cleared. */
  savedSectionLengths: number[] | null
  /** Sections that came out different from the saved link, waiting for the user to confirm. */
  routeChanges: RouteSectionChange[]
  /** Stretches derived from the live route geometry (export, lengths). */
  segments: RouteSegment[]
  /** The whole route as one line, updated when its waypoints change (not on every hover). */
  routeLine: Position[]
  /** Clicked points on the live route; `0` until the route tool has loaded the route. */
  waypointCount: number
  snapMode: boolean
  undoLength: number
  routeToolGeoJson: FeatureCollection
  actions: {
    setRouteToolGeoJson: (geojson: FeatureCollection) => void
    setSegments: (segments: RouteSegment[]) => void
    setRouteLine: (line: Position[]) => void
    setWaypoints: (waypoints: FlaggedWaypoint[]) => void
    hydrateRoute: (waypoints: FlaggedWaypoint[], savedSectionLengths: number[] | null) => void
    setSavedSectionLengths: (lengths: number[] | null) => void
    setRouteChanges: (changes: RouteSectionChange[]) => void
    setWaypointCount: (count: number) => void
    setSnapMode: (enabled: boolean) => void
    setUndoLength: (length: number) => void
    clearRoute: () => void
  }
}

const useRouteStore = create<RouteStore>((set) => ({
  waypoints: [],
  savedSectionLengths: null,
  routeChanges: [],
  segments: [],
  routeLine: [],
  waypointCount: 0,
  snapMode: true,
  undoLength: 0,
  routeToolGeoJson: emptyRouteToolGeoJson,
  actions: {
    setRouteToolGeoJson: (geojson) => set({ routeToolGeoJson: geojson }),
    setSegments: (segments) => set({ segments }),
    setRouteLine: (routeLine) => set({ routeLine }),
    setWaypoints: (waypoints) => set({ waypoints }),
    hydrateRoute: (waypoints, savedSectionLengths) =>
      set({ waypoints, savedSectionLengths, routeChanges: [] }),
    setSavedSectionLengths: (lengths) => set({ savedSectionLengths: lengths }),
    setRouteChanges: (changes) => set({ routeChanges: changes }),
    setWaypointCount: (count) =>
      set((state) => (state.waypointCount === count ? state : { waypointCount: count })),
    setSnapMode: (enabled) => set({ snapMode: enabled }),
    setUndoLength: (length) => set({ undoLength: length }),
    clearRoute: () =>
      set({
        waypoints: [],
        savedSectionLengths: null,
        routeChanges: [],
        segments: [],
        routeLine: [],
        waypointCount: 0,
        routeToolGeoJson: emptyRouteToolGeoJson,
        undoLength: 0,
      }),
  },
}))

export function useRouteSegments() {
  return useRouteStore((state) => state.segments)
}

export function useRouteWaypoints() {
  return useRouteStore((state) => state.waypoints)
}

export function useRouteLine() {
  return useRouteStore((state) => state.routeLine)
}

export function useRouteChanges() {
  return useRouteStore((state) => state.routeChanges)
}

export function useRouteToolGeoJson() {
  return useRouteStore((state) => state.routeToolGeoJson)
}

export function useRouteWaypointCount() {
  return useRouteStore((state) => state.waypointCount)
}

export function useRouteSnapMode() {
  return useRouteStore((state) => state.snapMode)
}

export function useRouteUndoLength() {
  return useRouteStore((state) => state.undoLength)
}

export function useRouteActions() {
  return useRouteStore((state) => state.actions)
}

/** Read outside React (route tool callbacks). */
export function getRouteState() {
  return useRouteStore.getState()
}

export function setRouteSnapModeState(enabled: boolean) {
  useRouteStore.getState().actions.setSnapMode(enabled)
}

export function setRouteWaypointsState(waypoints: FlaggedWaypoint[]) {
  useRouteStore.getState().actions.setWaypoints(waypoints)
}

export function setRouteWaypointCountState(count: number) {
  useRouteStore.getState().actions.setWaypointCount(count)
}

export function clearRouteState() {
  useRouteStore.getState().actions.clearRoute()
}
