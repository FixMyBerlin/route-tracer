import { create } from 'zustand'

type MapChromeState = {
  mapLoaded: boolean
  osmStorageReady: boolean
  /** Bumps when the map camera settles so sidebar coverage controls can re-read bounds. */
  viewEpoch: number
  actions: {
    markMapLoaded: () => void
    markOsmStorageReady: () => void
    bumpViewEpoch: () => void
  }
}

const useMapChromeStore = create<MapChromeState>((set) => ({
  mapLoaded: false,
  osmStorageReady: false,
  viewEpoch: 0,
  actions: {
    markMapLoaded: () => set({ mapLoaded: true }),
    markOsmStorageReady: () => set({ osmStorageReady: true }),
    bumpViewEpoch: () => set((state) => ({ viewEpoch: state.viewEpoch + 1 })),
  },
}))

export function useMapLoaded() {
  return useMapChromeStore((state) => state.mapLoaded)
}

export function useOsmStorageReady() {
  return useMapChromeStore((state) => state.osmStorageReady)
}

export function useMapViewEpoch() {
  return useMapChromeStore((state) => state.viewEpoch)
}

export function useMapChromeActions() {
  return useMapChromeStore((state) => state.actions)
}
