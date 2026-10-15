import type { Position } from 'geojson'
import {
  closestPointOnSegmentXY,
  createLocalProjection,
  lonLatOf,
} from '@/shared/routing/auto-snap/local-meters'
import { haversineMeters } from '@/shared/routing/haversine'

/** Cumulative along-line distance in meters at every vertex; the first entry is 0. */
function cumulativeMeters(line: Position[]) {
  const cumulative = [0]
  for (let index = 1; index < line.length; index += 1) {
    const [lon1, lat1] = lonLatOf(line[index - 1] ?? [])
    const [lon2, lat2] = lonLatOf(line[index] ?? [])
    cumulative.push((cumulative[index - 1] ?? 0) + haversineMeters(lat1, lon1, lat2, lon2))
  }
  return cumulative
}

/** Position `t` of the way from `a` to `b` in lon/lat. Fine for the short spans used here. */
function lerpPosition(a: Position, b: Position, t: number): Position {
  const [lon1, lat1] = lonLatOf(a)
  const [lon2, lat2] = lonLatOf(b)
  return [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t]
}

/** Vertices of `line` plus points in between, at most `stepMeters` apart. */
function densify(line: Position[], stepMeters: number): Position[] {
  const dense: Position[] = []
  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index]
    const end = line[index + 1]
    if (!start || !end) continue
    const [lon1, lat1] = lonLatOf(start)
    const [lon2, lat2] = lonLatOf(end)
    const steps = Math.max(1, Math.ceil(haversineMeters(lat1, lon1, lat2, lon2) / stepMeters))
    for (let step = 0; step < steps; step += 1) {
      dense.push(lerpPosition(start, end, step / steps))
    }
  }
  const last = line.at(-1)
  if (last) dense.push(last)
  return dense
}

/** Largest distance from any densified point of `from` to the polyline `to`. */
function directedDeviationMeters(from: Position[], to: Position[], stepMeters: number) {
  const project = createLocalProjection(to[0] ?? [])
  const target = to.map((position) => project.toXY(position))

  let worst = 0
  for (const point of densify(from, stepMeters)) {
    const xy = project.toXY(point)
    let nearest = Number.POSITIVE_INFINITY
    for (let index = 0; index < target.length - 1; index += 1) {
      const start = target[index]
      const end = target[index + 1]
      if (!start || !end) continue
      nearest = Math.min(nearest, closestPointOnSegmentXY(xy, start, end).distance)
    }
    worst = Math.max(worst, nearest)
  }
  return worst
}

function sameCoordinates(a: Position[], b: Position[]) {
  return (
    a.length === b.length &&
    a.every((position, index) => {
      const other = b[index]
      return other !== undefined && position[0] === other[0] && position[1] === other[1]
    })
  )
}

/**
 * Symmetric max distance (discrete Hausdorff) in meters between two polylines: densify both
 * every `stepMeters` and take the largest distance from a point on one line to the other.
 * Returns 0 for identical lines and Infinity if either has fewer than two points.
 */
export function maxDeviationMeters(a: Position[], b: Position[], stepMeters = 5): number {
  if (a.length < 2 || b.length < 2) return Number.POSITIVE_INFINITY
  if (sameCoordinates(a, b)) return 0
  return Math.max(
    directedDeviationMeters(a, b, stepMeters),
    directedDeviationMeters(b, a, stepMeters),
  )
}

/** Sub-line of `line` between along-track distances `fromMeters` and `toMeters`, clamped to the line. */
export function sliceLineByDistance(
  line: Position[],
  fromMeters: number,
  toMeters: number,
): Position[] {
  if (line.length === 0) return []
  const cumulative = cumulativeMeters(line)
  const total = cumulative.at(-1) ?? 0
  const from = Math.min(total, Math.max(0, fromMeters))
  const to = Math.min(total, Math.max(0, toMeters))

  const pointAt = (distance: number): Position => {
    if (line.length === 1) return line[0] ?? []
    let index = 0
    while (index < line.length - 2 && (cumulative[index + 1] ?? 0) < distance) index += 1
    const segmentStart = cumulative[index] ?? 0
    const segmentLength = (cumulative[index + 1] ?? 0) - segmentStart
    const t = segmentLength === 0 ? 0 : (distance - segmentStart) / segmentLength
    return lerpPosition(line[index] ?? [], line[index + 1] ?? [], Math.min(1, Math.max(0, t)))
  }

  const start = pointAt(from)
  if (to <= from) return [start]

  const interior = line.filter((_, index) => {
    const distance = cumulative[index] ?? 0
    return distance > from && distance < to
  })
  return [start, ...interior, pointAt(to)]
}

/**
 * Along-line distance in meters of the point on `line` nearest to `point`, searching only at or
 * after `fromMeters`, so a route that passes the same spot twice resolves to the right visit.
 * `distanceMeters` is the gap between `point` and that nearest point.
 */
export function locateAlongLine(
  line: Position[],
  point: Position,
  fromMeters = 0,
): { alongMeters: number; distanceMeters: number } {
  if (line.length === 0) return { alongMeters: 0, distanceMeters: Number.POSITIVE_INFINITY }

  const project = createLocalProjection(point)
  const origin = project.toXY(point)
  const vertices = line.map((position) => project.toXY(position))
  const cumulative = cumulativeMeters(line)

  if (line.length === 1) {
    const [x = 0, y = 0] = vertices[0] ?? []
    return { alongMeters: 0, distanceMeters: Math.hypot(x - origin[0], y - origin[1]) }
  }

  let best = { alongMeters: 0, distanceMeters: Number.POSITIVE_INFINITY }
  for (let index = 0; index < line.length - 1; index += 1) {
    const segmentStart = cumulative[index] ?? 0
    const segmentEnd = cumulative[index + 1] ?? 0
    if (segmentEnd < fromMeters) continue

    const segmentLength = segmentEnd - segmentStart
    const minT =
      segmentLength === 0
        ? 0
        : Math.min(1, Math.max(0, (fromMeters - segmentStart) / segmentLength))
    const start = vertices[index]
    const end = vertices[index + 1]
    if (!start || !end) continue

    const hit = closestPointOnSegmentXY(origin, start, end, minT)
    if (hit.distance < best.distanceMeters) {
      best = {
        alongMeters: segmentStart + hit.t * segmentLength,
        distanceMeters: hit.distance,
      }
    }
  }
  return best
}
