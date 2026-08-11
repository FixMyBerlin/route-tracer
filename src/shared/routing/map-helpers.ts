import type { MapBounds } from '@osm-editor-kit/osm-data'
import type { Map as MapLibreMap } from 'maplibre-gl'

export function toBounds(mapBounds: {
  getSouth: () => number
  getWest: () => number
  getNorth: () => number
  getEast: () => number
}): MapBounds {
  return {
    south: mapBounds.getSouth(),
    west: mapBounds.getWest(),
    north: mapBounds.getNorth(),
    east: mapBounds.getEast(),
  }
}

export function getMapSizePx(map: { getContainer: () => HTMLElement }) {
  const container = map.getContainer()
  return {
    width: container.clientWidth,
    height: container.clientHeight,
  }
}

export type CoverageFetchArgs = {
  bounds: MapBounds
  zoom: number
  mapSizePx: { width: number; height: number }
}

export function scheduleCoverageFromMap(map: MapLibreMap): CoverageFetchArgs {
  return {
    bounds: toBounds(map.getBounds()),
    zoom: map.getZoom(),
    mapSizePx: getMapSizePx(map),
  }
}
