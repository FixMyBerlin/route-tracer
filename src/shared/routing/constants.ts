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

export const ROUTE_LINE_WIDTH_PX = 5
/**
 * Shift snapped strokes to the right of travel (80% of width). Outbound and
 * inbound then sit on opposite sides of the road, so a backtrace stays visible.
 */
export const ROUTE_SNAPPED_LINE_OFFSET_PX = ROUTE_LINE_WIDTH_PX * 0.8

/** Confirmed waypoints: graph/OSM nodes vs mid-edge / freehand points. */
export const ROUTE_WAYPOINT_COLORS = {
  edge: '#dc2626',
  mid: '#ea580c',
} as const
