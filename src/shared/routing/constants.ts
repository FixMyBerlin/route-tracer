/** Minimum zoom before viewport OSM coverage is fetched. */
export const viewMinZoom = 15

/** Debounce map moves before triggering Overpass coverage fetches. */
export const coverageFetchDebounceMs = 400

/** Overpass hairline (sky) vs routing-graph hairline (purple). */
export const NETWORK_HIGHLIGHT_COLORS = {
  overpass: '#38bdf8',
  routing: '#7c3aed',
} as const

/** Route segment paints — keep map layers, legend, and list swatches in sync. */
export const ROUTE_SEGMENT_COLORS = {
  snapped: '#0f172a',
  freehand: '#0f172a',
} as const
