import { create } from 'zustand'

type MapChromeState = {
  osmDataBusy: boolean
  actions: {
    setOsmDataBusy: (busy: boolean) => void
  }
}

const useMapChromeStore = create<MapChromeState>((set) => ({
  osmDataBusy: false,
  actions: {
    setOsmDataBusy: (busy) => set({ osmDataBusy: busy }),
  },
}))

export function useMapChromeOsmBusy() {
  return useMapChromeStore((state) => state.osmDataBusy)
}

export function useMapChromeActions() {
  return useMapChromeStore((state) => state.actions)
}
