import { computeMissingFetchRequests } from '@osm-editor-kit/osm-coverage'
import type { MapBounds } from '@osm-editor-kit/osm-data'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { viewMinZoom } from '@/shared/routing/constants'

type MapSizePx = { width: number; height: number }

/** True when ensureCoverage would request Overpass for this viewport. */
export function viewportNeedsOsmFetch(
  bounds: MapBounds,
  coverage: Feature<Polygon | MultiPolygon> | null | undefined,
  zoom: number,
  mapSizePx: MapSizePx,
  minZoom = viewMinZoom,
): boolean {
  if (zoom < minZoom) return false
  return computeMissingFetchRequests(bounds, coverage ?? null, zoom, mapSizePx).length > 0
}
