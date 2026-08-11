import { routerSearch as baseRouterSearch } from '@osm-editor-kit/osm-map-url'
import { encodeOverlaySearch } from '@/shared/reference-image/overlay-search-codec'
import type { ImageCoords, OverlaySearchState } from '@/shared/reference-image/types'

function isImageCoords(value: unknown): value is ImageCoords {
  return Array.isArray(value) && value.length === 4
}

function isOverlaySearchState(value: unknown): value is OverlaySearchState {
  if (typeof value !== 'object' || value == null) return false
  const overlay = value as OverlaySearchState
  return isImageCoords(overlay.corners) && typeof overlay.opacity === 'number'
}

function normalizeOverlayForStringify(search: Record<string, unknown>): Record<string, unknown> {
  if (isOverlaySearchState(search.overlay)) {
    return { ...search, overlay: encodeOverlaySearch(search.overlay) }
  }
  return search
}

/** Extends osm-map-url router search with compressed overlay param round-tripping. */
export const routerSearch = {
  parse: baseRouterSearch.parse,
  stringify: (search: Record<string, unknown>) =>
    baseRouterSearch.stringify(normalizeOverlayForStringify(search)),
}
