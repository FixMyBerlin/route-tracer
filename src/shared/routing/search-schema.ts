import { parseMapParam, type MapParam } from '@osm-editor-kit/osm-map-url'
import { z } from 'zod'

export const mapParamFallback: MapParam = { lat: 52.5, lng: 13.4, zoom: 12.1 }

export const indexSearchSchema = z.object({
  map: z
    .string()
    .optional()
    .transform((value) => parseMapParam(value ?? '') ?? mapParamFallback),
})

export type IndexSearch = z.infer<typeof indexSearchSchema>
