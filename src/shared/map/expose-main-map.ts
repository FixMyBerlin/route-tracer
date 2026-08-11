import type { Map as MaplibreMap } from 'maplibre-gl'

export function exposeMainMapForDebugging(map: MaplibreMap) {
  if (!import.meta.env.DEV) return
  window.__mainMap = map
}
