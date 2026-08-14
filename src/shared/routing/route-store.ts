import type { FeatureCollection } from 'geojson'
import { create } from 'zustand'
import type { RouteSegment } from '@/shared/routing/route-segments'

const emptyRouteToolGeoJson: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
}

type RouteStore = {
  segments: RouteSegment[]
  snapMode: boolean
  undoLength: number
  routeToolGeoJson: FeatureCollection
  actions: {
    setRouteToolGeoJson: (geojson: FeatureCollection) => void
    setSegments: (segments: RouteSegment[]) => void
    setSnapMode: (enabled: boolean) => void
    setUndoLength: (length: number) => void
    clearRoute: () => void
  }
}

const useRouteStore = create<RouteStore>((set) => ({
  segments: [],
  snapMode: true,
  undoLength: 0,
  routeToolGeoJson: emptyRouteToolGeoJson,
  actions: {
    setRouteToolGeoJson: (geojson) => set({ routeToolGeoJson: geojson }),
    setSegments: (segments) => set({ segments }),
    setSnapMode: (enabled) => set({ snapMode: enabled }),
    setUndoLength: (length) => set({ undoLength: length }),
    clearRoute: () =>
      set({
        segments: [],
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

export function clearRouteState() {
  useRouteStore.getState().actions.clearRoute()
}
