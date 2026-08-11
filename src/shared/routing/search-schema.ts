import { parseMapParam, serializeMapParam, type MapParam } from '@osm-editor-kit/osm-map-url'
import { z } from 'zod'
import {
  decodeOverlaySearch,
  encodeOverlaySearch,
} from '@/shared/reference-image/overlay-search-codec'
import { decodeRouteSearch, encodeRouteSearch } from '@/shared/routing/route-search-codec'

export const mapParamFallback: MapParam = { lat: 52.5, lng: 13.4, zoom: 12.1 }

export const indexSearchSchema = z.object({
  map: z
    .string()
    .optional()
    .transform((value) => parseMapParam(value ?? '') ?? mapParamFallback),
  overlay: z
    .string()
    .optional()
    .transform((value) => decodeOverlaySearch(value)),
  route: z
    .string()
    .optional()
    .transform((value) => decodeRouteSearch(value)),
})

export type IndexSearch = z.infer<typeof indexSearchSchema>

export type IndexSearchParams = {
  map?: string
  overlay?: string
  route?: string
}

export function serializeIndexSearch(search: IndexSearch): IndexSearchParams {
  return {
    map: serializeMapParam(search.map),
    overlay: search.overlay ? encodeOverlaySearch(search.overlay) : undefined,
    route: search.route?.length ? encodeRouteSearch(search.route) : undefined,
  }
}
