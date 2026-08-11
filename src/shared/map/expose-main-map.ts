import type { Map as MaplibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    __mainMap?: MaplibreMap
  }
}

export function exposeMainMapForDebugging(map: MaplibreMap) {
  window.__mainMap = map
}
