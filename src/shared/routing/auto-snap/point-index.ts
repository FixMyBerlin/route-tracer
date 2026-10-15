import type { Position } from 'geojson'
import {
  closestPointOnSegmentXY,
  createLocalProjection,
  lonLatOf,
} from '@/shared/routing/auto-snap/local-meters'
import { haversineMeters } from '@/shared/routing/haversine'

/** Grid-hashed point set for fast nearest lookups (graph nodes, densified lines). */
export type PointIndex = {
  nearest(
    position: Position,
    maxMeters: number,
  ): { position: Position; index: number; distanceMeters: number } | null
}

/** Grid-hashed polyline segments for fast distance-to-line queries. */
export type SegmentIndex = {
  /**
   * Closest point on the line within `maxMeters`: its distance, the index of the segment it lies
   * on (`line[i]` to `line[i + 1]`) and `t` along that segment. Null if nothing is that close.
   */
  nearest(
    position: Position,
    maxMeters: number,
  ): { distanceMeters: number; segmentIndex: number; t: number } | null
  /** Distance in meters to the line, or Infinity if nothing lies within `maxMeters`. */
  distance(position: Position, maxMeters: number): number
}

type CellBounds = { minX: number; maxX: number; minY: number; maxY: number }

type CellGrid = {
  cells: Map<number, number[]>
  bounds: CellBounds | null
}

function createCellGrid(): CellGrid {
  return { cells: new Map(), bounds: null }
}

/** Packs cell coordinates into one number, so cell lookups in hot loops avoid string keys. */
function cellKey(cx: number, cy: number) {
  return cx * 1_000_003 + cy
}

function addToCell(grid: CellGrid, cx: number, cy: number, id: number) {
  const key = cellKey(cx, cy)
  const ids = grid.cells.get(key)
  if (ids) {
    // Long segments are inserted piece by piece, so the same id can repeat in a row.
    if (ids.at(-1) !== id) ids.push(id)
  } else {
    grid.cells.set(key, [id])
  }
  const bounds = grid.bounds
  grid.bounds = bounds
    ? {
        minX: Math.min(bounds.minX, cx),
        maxX: Math.max(bounds.maxX, cx),
        minY: Math.min(bounds.minY, cy),
        maxY: Math.max(bounds.maxY, cy),
      }
    : { minX: cx, maxX: cx, minY: cy, maxY: cy }
}

/** Calls `visit` for each cell key at Chebyshev distance `ring` from the cell `(cx, cy)`. */
function visitRing(cx: number, cy: number, ring: number, visit: (key: number) => void) {
  if (ring === 0) {
    visit(cellKey(cx, cy))
    return
  }
  for (let dx = -ring; dx <= ring; dx += 1) {
    visit(cellKey(cx + dx, cy - ring))
    visit(cellKey(cx + dx, cy + ring))
  }
  for (let dy = -ring + 1; dy <= ring - 1; dy += 1) {
    visit(cellKey(cx - ring, cy + dy))
    visit(cellKey(cx + ring, cy + dy))
  }
}

/**
 * Largest ring worth searching from `(cx, cy)`: enough to cover `maxMeters`, and no further than
 * the indexed cells reach. A negative result means nothing to search.
 */
function ringLimit(
  bounds: CellBounds | null,
  cx: number,
  cy: number,
  maxMeters: number,
  cellMeters: number,
) {
  if (!bounds) return -1
  const reach = Math.max(
    Math.abs(cx - bounds.minX),
    Math.abs(cx - bounds.maxX),
    Math.abs(cy - bounds.minY),
    Math.abs(cy - bounds.maxY),
  )
  return Math.min(reach, Math.ceil(maxMeters / cellMeters))
}

/** Centre of the bounding box of `points`, used as the projection origin. */
function boundingCentre(points: Position[]): Position {
  let minLon = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  for (const position of points) {
    const [lon, lat] = lonLatOf(position)
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  if (!Number.isFinite(minLon)) return [0, 0]
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
}

/** Nearest point in `points` to `position`, searching rings of `cellMeters` grid cells. */
export function createPointIndex(points: Position[], cellMeters = 50): PointIndex {
  const project = createLocalProjection(boundingCentre(points))
  const xy = points.map((position) => project.toXY(position))
  const grid = createCellGrid()
  xy.forEach(([x, y], index) => {
    addToCell(grid, Math.floor(x / cellMeters), Math.floor(y / cellMeters), index)
  })

  return {
    nearest(position, maxMeters) {
      const query = project.toXY(position)
      const cx = Math.floor(query[0] / cellMeters)
      const cy = Math.floor(query[1] / cellMeters)
      const limit = ringLimit(grid.bounds, cx, cy, maxMeters, cellMeters)
      const found = { index: -1, distance: Number.POSITIVE_INFINITY }

      for (let ring = 0; ring <= limit; ring += 1) {
        visitRing(cx, cy, ring, (key) => {
          for (const index of grid.cells.get(key) ?? []) {
            const candidate = xy[index]
            if (!candidate) continue
            const distance = Math.hypot(candidate[0] - query[0], candidate[1] - query[1])
            if (distance < found.distance) {
              found.index = index
              found.distance = distance
            }
          }
        })
        // Anything in a farther ring is at least `ring * cellMeters` away.
        if (found.index >= 0 && found.distance <= ring * cellMeters) break
      }

      const hit = points[found.index]
      if (!hit) return null
      const [lon, lat] = lonLatOf(hit)
      const [queryLon, queryLat] = lonLatOf(position)
      const distanceMeters = haversineMeters(queryLat, queryLon, lat, lon)
      if (distanceMeters > maxMeters) return null
      return { position: hit, index: found.index, distanceMeters }
    },
  }
}

/**
 * Segment index over a polyline. Each segment is cut into pieces no longer than `cellMeters` and
 * registered in every cell its piece's bounding box covers, so a query only visits nearby cells.
 */
export function createSegmentIndex(line: Position[], cellMeters = 50): SegmentIndex {
  const project = createLocalProjection(boundingCentre(line))
  const vertices = line.map((position) => project.toXY(position))
  const grid = createCellGrid()

  for (let segment = 0; segment < vertices.length - 1; segment += 1) {
    const a = vertices[segment]
    const b = vertices[segment + 1]
    if (!a || !b) continue
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    const pieces = Math.max(1, Math.ceil(length / cellMeters))
    for (let piece = 0; piece < pieces; piece += 1) {
      const from = piece / pieces
      const to = (piece + 1) / pieces
      const x1 = a[0] + (b[0] - a[0]) * from
      const y1 = a[1] + (b[1] - a[1]) * from
      const x2 = a[0] + (b[0] - a[0]) * to
      const y2 = a[1] + (b[1] - a[1]) * to
      const minCx = Math.floor(Math.min(x1, x2) / cellMeters)
      const maxCx = Math.floor(Math.max(x1, x2) / cellMeters)
      const minCy = Math.floor(Math.min(y1, y2) / cellMeters)
      const maxCy = Math.floor(Math.max(y1, y2) / cellMeters)
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        for (let cy = minCy; cy <= maxCy; cy += 1) addToCell(grid, cx, cy, segment)
      }
    }
  }

  // Per-query dedupe: a segment sits in several cells, so it can be reached more than once.
  const seen = new Uint32Array(Math.max(0, vertices.length - 1))
  let stamp = 0

  const nearest: SegmentIndex['nearest'] = (position, maxMeters) => {
    if (!grid.bounds) return null
    stamp += 1
    const query = project.toXY(position)
    const cx = Math.floor(query[0] / cellMeters)
    const cy = Math.floor(query[1] / cellMeters)
    const limit = ringLimit(grid.bounds, cx, cy, maxMeters, cellMeters)
    const found = { distanceMeters: Number.POSITIVE_INFINITY, segmentIndex: -1, t: 0 }

    for (let ring = 0; ring <= limit; ring += 1) {
      visitRing(cx, cy, ring, (key) => {
        for (const segment of grid.cells.get(key) ?? []) {
          if (seen[segment] === stamp) continue
          seen[segment] = stamp
          const start = vertices[segment]
          const end = vertices[segment + 1]
          if (!start || !end) continue
          const hit = closestPointOnSegmentXY(query, start, end)
          if (hit.distance < found.distanceMeters) {
            found.distanceMeters = hit.distance
            found.segmentIndex = segment
            found.t = hit.t
          }
        }
      })
      if (found.segmentIndex >= 0 && found.distanceMeters <= ring * cellMeters) break
    }

    if (found.segmentIndex < 0 || found.distanceMeters > maxMeters) return null
    return found
  }

  return {
    nearest,
    distance(position, maxMeters) {
      return nearest(position, maxMeters)?.distanceMeters ?? Number.POSITIVE_INFINITY
    },
  }
}
