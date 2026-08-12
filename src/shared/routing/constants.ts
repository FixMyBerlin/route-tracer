/** Minimum zoom before viewport OSM coverage is fetched. */
export const viewMinZoom = 15

/** Debounce map moves before triggering Overpass coverage fetches. */
export const coverageFetchDebounceMs = 400

/** Overpass casing (sky) vs routing-graph dotted outline (black). */
export const NETWORK_HIGHLIGHT_COLORS = {
  overpass: '#38bdf8',
  routing: '#0f172a',
} as const

/** Route segment paints — keep map layers, legend, and list swatches in sync. */
export const ROUTE_SEGMENT_COLORS = {
  snapped: '#0284c7',
  freehand: '#ea580c',
} as const
