import type { MapBounds } from '@osm-editor-kit/osm-data'
import type { Position } from 'geojson'
import { haversineMeters } from '@/shared/routing/haversine'

export type LineChunk = {
  bounds: MapBounds
  /** The line's vertices inside this chunk — what has to be covered by loaded roads. */
  positions: Position[]
}

const METERS_PER_DEGREE_LAT = 110_540

/**
 * Cut a line into pieces of about `chunkMeters` and box each one with `bufferMeters` around
 * it, so roads along a long route load as a row of small requests instead of one huge box.
 */
export function chunkLineBounds(
  line: Position[],
  { chunkMeters = 1500, bufferMeters = 60 }: { chunkMeters?: number; bufferMeters?: number } = {},
): LineChunk[] {
  const chunks: LineChunk[] = []
  let current: Position[] = []
  let currentMeters = 0

  const close = () => {
    if (current.length === 0) return
    let south = Infinity
    let west = Infinity
    let north = -Infinity
    let east = -Infinity
    for (const [lon = 0, lat = 0] of current) {
      south = Math.min(south, lat)
      north = Math.max(north, lat)
      west = Math.min(west, lon)
      east = Math.max(east, lon)
    }
    const latBuffer = bufferMeters / METERS_PER_DEGREE_LAT
    const midLat = ((south + north) / 2) * (Math.PI / 180)
    const lonBuffer = bufferMeters / (METERS_PER_DEGREE_LAT * Math.max(Math.cos(midLat), 0.01))
    chunks.push({
      bounds: {
        south: south - latBuffer,
        west: west - lonBuffer,
        north: north + latBuffer,
        east: east + lonBuffer,
      },
      positions: current,
    })
  }

  for (const position of line) {
    const previous = current.at(-1)
    if (previous) {
      currentMeters += haversineMeters(
        previous[1] ?? 0,
        previous[0] ?? 0,
        position[1] ?? 0,
        position[0] ?? 0,
      )
    }
    current.push(position)
    if (currentMeters >= chunkMeters) {
      close()
      // The next chunk starts where this one ended, so no stretch falls between two boxes.
      current = [position]
      currentMeters = 0
    }
  }
  if (current.length > 1 || chunks.length === 0) close()

  return chunks
}
