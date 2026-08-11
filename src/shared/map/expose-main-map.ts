import type { Map as MaplibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    __mainMap?: MaplibreMap
    __loadCoverage?: () => void
  }
}

export function exposeMainMapForDebugging(map: MaplibreMap) {
  window.__mainMap = map
}

export function exposeCoverageLoaderForDebugging(load: (map: MaplibreMap) => void) {
  window.__loadCoverage = () => {
    const map = window.__mainMap
    if (map) load(map)
  }
}
