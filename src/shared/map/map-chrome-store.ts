import { create } from 'zustand'

type MapChromeState = {
  mapLoaded: boolean
  osmDataBusy: boolean
  actions: {
    markMapLoaded: () => void
    setOsmDataBusy: (busy: boolean) => void
  }
}

const useMapChromeStore = create<MapChromeState>((set) => ({
  mapLoaded: false,
  osmDataBusy: false,
  actions: {
    markMapLoaded: () => set((state) => (state.mapLoaded ? state : { mapLoaded: true })),
    setOsmDataBusy: (busy) => set({ osmDataBusy: busy }),
  },
}))

export function useMapLoaded() {
  return useMapChromeStore((state) => state.mapLoaded)
}

export function useMapChromeOsmBusy() {
  return useMapChromeStore((state) => state.osmDataBusy)
}

export function useMapChromeActions() {
  return useMapChromeStore((state) => state.actions)
}
