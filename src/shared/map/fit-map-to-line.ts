import type { Position } from 'geojson'
import type { Map as MapLibreMap } from 'maplibre-gl'

/** Move the map so the whole line is in view, leaving room around it. */
export function fitMapToLine(
  map: MapLibreMap | null | undefined,
  line: Position[],
  { maxZoom = 17 }: { maxZoom?: number } = {},
) {
  if (!map || line.length === 0) return
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lon = 0, lat = 0] of line) {
    west = Math.min(west, lon)
    east = Math.max(east, lon)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding: 60, maxZoom, duration: 600 },
  )
}
