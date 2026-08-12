/// <reference types="vite/client" />

import type { Map as MaplibreMap } from 'maplibre-gl'

declare global {
  interface Window {
    __mainMap?: MaplibreMap
  }
}

export {}
