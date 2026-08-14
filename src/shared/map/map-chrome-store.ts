import { create } from 'zustand'

type MapChromeState = {
  mapLoaded: boolean
  osmDataBusy: boolean
  osmStorageReady: boolean
  /** Bumps when the map camera settles so sidebar coverage controls can re-read bounds. */
  viewEpoch: number
  actions: {
    markMapLoaded: () => void
    setOsmDataBusy: (busy: boolean) => void
    setOsmStorageReady: (ready: boolean) => void
    bumpViewEpoch: () => void
  }
}

const useMapChromeStore = create<MapChromeState>((set) => ({
  mapLoaded: false,
  osmDataBusy: false,
  osmStorageReady: false,
  viewEpoch: 0,
  actions: {
    markMapLoaded: () => set((state) => (state.mapLoaded ? state : { mapLoaded: true })),
    setOsmDataBusy: (busy) =>
      set((state) => (state.osmDataBusy === busy ? state : { osmDataBusy: busy })),
    setOsmStorageReady: (ready) =>
      set((state) => (state.osmStorageReady === ready ? state : { osmStorageReady: ready })),
    bumpViewEpoch: () => set((state) => ({ viewEpoch: state.viewEpoch + 1 })),
  },
}))

export function useMapLoaded() {
  return useMapChromeStore((state) => state.mapLoaded)
}

export function useMapChromeOsmBusy() {
  return useMapChromeStore((state) => state.osmDataBusy)
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
