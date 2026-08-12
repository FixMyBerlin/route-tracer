import { parseMapParam, serializeMapParam, type MapParam } from '@osm-editor-kit/osm-map-url'
import { z } from 'zod'
import {
  decodeOverlaySearch,
  encodeOverlaySearch,
} from '@/shared/reference-image/overlay-search-codec'
import { decodeRouteSearch, encodeRouteSearch } from '@/shared/routing/route-search-codec'
import type { RouteSegment } from '@/shared/routing/route-segments'
import { workflowSteps, type WorkflowStep } from '@/shared/routing/workflow-steps'

export const mapParamFallback: MapParam = { lat: 52.5, lng: 13.4, zoom: 12.1 }

/** Parsed index-route search (output of `validateSearch`). */
export const indexSearchSchema = z.object({
  step: z.enum(workflowSteps).default('image').catch('image'),
  map: z
    .string()
    .optional()
    .transform((value) => parseMapParam(value ?? '') ?? mapParamFallback),
  imageSource: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed : undefined
    }),
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

/** Wire-format search params for redirects, export links, and tests — not for `navigate({ search })`. */
export type IndexSearchParams = {
  step?: WorkflowStep
  map?: string
  imageSource?: string
  overlay?: string
  route?: string
}

function isOverlaySearchState(value: unknown): value is NonNullable<IndexSearch['overlay']> {
  if (typeof value !== 'object' || value == null) return false
  const overlay = value as NonNullable<IndexSearch['overlay']>
  return (
    Array.isArray(overlay.corners) &&
    overlay.corners.length === 4 &&
    typeof overlay.opacity === 'number'
  )
}

function isRouteSegments(value: unknown): value is RouteSegment[] {
  return Array.isArray(value) && value.length > 0
}

/** Build a query object for manual URL construction outside TanStack Router navigation. */
export function serializeIndexSearch(search: IndexSearch): IndexSearchParams {
  return {
    step: search.step,
    map: serializeMapParam(search.map),
    imageSource: search.imageSource,
    overlay: isOverlaySearchState(search.overlay) ? encodeOverlaySearch(search.overlay) : undefined,
    route: isRouteSegments(search.route) ? encodeRouteSearch(search.route) : undefined,
  }
}
