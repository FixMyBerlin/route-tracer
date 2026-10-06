import type { Map as MaplibreMap } from 'maplibre-gl'

/** `window.__mainMap` for the dev console and browser automation. Typed in `vite-env.d.ts`. */
export function exposeMainMapForDebugging(map: MaplibreMap) {
  if (!import.meta.env.DEV) return
  window.__mainMap = map
}
