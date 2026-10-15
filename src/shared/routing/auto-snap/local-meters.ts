import type { Position } from 'geojson'

export type LocalPoint = [number, number]

export type LocalProjection = {
  /** Local meters east and north of the projection origin. */
  toXY(position: Position): LocalPoint
}

/** Reads `[lon, lat]`. A malformed position yields NaN instead of a silent (0, 0). */
export function lonLatOf(position: Position): [number, number] {
  return [position[0] ?? Number.NaN, position[1] ?? Number.NaN]
}

/**
 * Equirectangular projection to local meters around `origin`. Accurate enough for the
 * few-kilometre spans a route segment covers; errors grow with distance from the origin.
 */
export function createLocalProjection(origin: Position): LocalProjection {
  const [originLon, originLat] = lonLatOf(origin)
  const cosLat = Math.cos((originLat * Math.PI) / 180)
  return {
    toXY(position) {
      const [lon, lat] = lonLatOf(position)
      return [(lon - originLon) * cosLat * 111_320, (lat - originLat) * 110_540]
    },
  }
}

/**
 * Closest point on the segment `a`-`b` to `p`, in the same plane. `t` is the position along the
 * segment (0 at `a`, 1 at `b`), clamped to `[minT, 1]` so a search can start part-way along.
 */
export function closestPointOnSegmentXY(
  p: LocalPoint,
  a: LocalPoint,
  b: LocalPoint,
  minT = 0,
): { distance: number; t: number } {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  const raw = lengthSquared === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared
  const t = Math.min(1, Math.max(minT, raw))
  return {
    distance: Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)),
    t,
  }
}

/** Distance in meters from `point` to the segment `from`-`to`, and the position `t` along it. */
export function pointToSegmentMeters(
  point: Position,
  from: Position,
  to: Position,
): { distance: number; t: number } {
  const project = createLocalProjection(from)
  return closestPointOnSegmentXY(project.toXY(point), project.toXY(from), project.toXY(to))
}

/**
 * Closest point on a polyline to `point`: its distance, the index of the segment it lies on
 * (`line[i]` to `line[i + 1]`), and `t` along that segment. An empty line gives an infinite
 * distance and segment index -1.
 */
export function pointToPolylineMeters(
  point: Position,
  line: Position[],
): { distance: number; segmentIndex: number; t: number } {
  if (line.length === 0) return { distance: Number.POSITIVE_INFINITY, segmentIndex: -1, t: 0 }

  const project = createLocalProjection(point)
  const origin = project.toXY(point)
  if (line.length === 1) {
    const [only] = line
    const distance = only ? Math.hypot(...project.toXY(only)) : Number.POSITIVE_INFINITY
    return { distance, segmentIndex: 0, t: 0 }
  }

  let best = { distance: Number.POSITIVE_INFINITY, segmentIndex: -1, t: 0 }
  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index]
    const end = line[index + 1]
    if (!start || !end) continue
    const hit = closestPointOnSegmentXY(origin, project.toXY(start), project.toXY(end))
    if (hit.distance < best.distance) best = { ...hit, segmentIndex: index }
  }
  return best
}
