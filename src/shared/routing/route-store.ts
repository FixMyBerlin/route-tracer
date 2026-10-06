import type { FeatureCollection } from 'geojson'
import { create } from 'zustand'
import type { RouteSegment } from '@/shared/routing/route-segments'

const emptyRouteToolGeoJson: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

type RouteStore = {
  segments: RouteSegment[]
  /** Clicked points on the live route; `0` until the route tool has loaded the route. */
  waypointCount: number
  snapMode: boolean
  undoLength: number
  routeToolGeoJson: FeatureCollection
  actions: {
    setRouteToolGeoJson: (geojson: FeatureCollection) => void
    setSegments: (segments: RouteSegment[]) => void
    setWaypointCount: (count: number) => void
    setSnapMode: (enabled: boolean) => void
    setUndoLength: (length: number) => void
    clearRoute: () => void
  }
}

const useRouteStore = create<RouteStore>((set) => ({
  segments: [],
  waypointCount: 0,
  snapMode: true,
  undoLength: 0,
  routeToolGeoJson: emptyRouteToolGeoJson,
  actions: {
    setRouteToolGeoJson: (geojson) => set({ routeToolGeoJson: geojson }),
    setSegments: (segments) => set({ segments }),
    setWaypointCount: (count) =>
      set((state) => (state.waypointCount === count ? state : { waypointCount: count })),
    setSnapMode: (enabled) => set({ snapMode: enabled }),
    setUndoLength: (length) => set({ undoLength: length }),
    clearRoute: () =>
      set({
        segments: [],
        waypointCount: 0,
        routeToolGeoJson: emptyRouteToolGeoJson,
        undoLength: 0,
      }),
  },
}))

export function useRouteSegments() {
  return useRouteStore((state) => state.segments)
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

export function setRouteSnapModeState(enabled: boolean) {
  useRouteStore.getState().actions.setSnapMode(enabled)
}

export function setRouteWaypointCountState(count: number) {
  useRouteStore.getState().actions.setWaypointCount(count)
}

export function clearRouteState() {
  useRouteStore.getState().actions.clearRoute()
}
