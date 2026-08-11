import { routerSearch as baseRouterSearch } from '@osm-editor-kit/osm-map-url'
import { encodeOverlaySearch } from '@/shared/reference-image/overlay-search-codec'
import type { ImageCoords, OverlaySearchState } from '@/shared/reference-image/types'
import { encodeRouteSearch } from '@/shared/routing/route-search-codec'
import type { RouteSegment } from '@/shared/routing/route-segments'

function isImageCoords(value: unknown): value is ImageCoords {
  return Array.isArray(value) && value.length === 4
}

function isOverlaySearchState(value: unknown): value is OverlaySearchState {
  if (typeof value !== 'object' || value == null) return false
  const overlay = value as OverlaySearchState
  return isImageCoords(overlay.corners) && typeof overlay.opacity === 'number'
}

function isRouteSegments(value: unknown): value is RouteSegment[] {
  return (
    Array.isArray(value) &&
    value.every(
      (segment) =>
        typeof segment === 'object' &&
        segment != null &&
        typeof segment.segment_index === 'number' &&
        (segment.segment_kind === 'snapped' || segment.segment_kind === 'manual') &&
        Array.isArray(segment.coordinates),
    )
  )
}

function normalizeOverlayForStringify(search: Record<string, unknown>): Record<string, unknown> {
  let next = search
  if (isOverlaySearchState(search.overlay)) {
    next = { ...next, overlay: encodeOverlaySearch(search.overlay) }
  }
  if (isRouteSegments(search.route)) {
    next = { ...next, route: encodeRouteSearch(search.route) }
  }
  return next
}

/** Extends osm-map-url router search with compressed overlay param round-tripping. */
export const routerSearch = {
  parse: baseRouterSearch.parse,
  stringify: (search: Record<string, unknown>) =>
    baseRouterSearch.stringify(normalizeOverlayForStringify(search)),
}
