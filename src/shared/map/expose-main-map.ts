import type { Map as MaplibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    __mainMap?: MaplibreMap
    __loadCoverage?: () => void
  }
}

export function exposeMainMapForDebugging(map: MaplibreMap) {
  if (!import.meta.env.DEV) return
  window.__mainMap = map
}

export function exposeCoverageLoaderForDebugging(load: (map: MaplibreMap) => void) {
  if (!import.meta.env.DEV) return
  window.__loadCoverage = () => {
    const map = window.__mainMap
    if (map) load(map)
  }
}
