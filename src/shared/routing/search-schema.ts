import { parseMapParam, type MapParam } from '@osm-editor-kit/osm-map-url'
import { z } from 'zod'
import { decodeOverlaySearch } from '@/shared/reference-image/overlay-search-codec'
import { decodeRouteSearch } from '@/shared/routing/route-search-codec'
import { workflowSteps, type WorkflowStep } from '@/shared/routing/workflow-steps'

const mapParamFallback: MapParam = { lat: 52.5, lng: 13.4, zoom: 12.1 }

const networkHighlightModes = ['invisible', 'overpass', 'routing'] as const
export type NetworkHighlightMode = (typeof networkHighlightModes)[number]

/** Defaults omitted from the URL via `stripSearchParams`. */
export const indexSearchDefaults = {
  step: 'image' as const satisfies WorkflowStep,
  /** Show the snap network while tracing so start/end clicks have a visible target. */
  network: 'routing' as const satisfies NetworkHighlightMode,
}

/** Parsed index-route search (output of `validateSearch`). */
export const indexSearchSchema = z.object({
  step: z.enum(workflowSteps).default(indexSearchDefaults.step).catch(indexSearchDefaults.step),
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
  /** Same-browser IndexedDB key for the reference image; not portable across devices. */
  imageId: z
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
  network: z
    .enum(networkHighlightModes)
    .default(indexSearchDefaults.network)
    .catch(indexSearchDefaults.network),
})

export type IndexSearch = z.infer<typeof indexSearchSchema>
