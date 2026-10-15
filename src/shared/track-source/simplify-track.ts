import type { Position } from 'geojson'

const EARTH_RADIUS_METERS = 6_371_000
const RADIANS_PER_DEGREE = Math.PI / 180

/**
 * Douglas–Peucker in local meters (equirectangular projection around the first point).
 * Always keeps first and last point.
 */
export function simplifyTrackMeters(coordinates: Position[], toleranceMeters: number): Position[] {
  const kept: Position[] = []
  for (const index of simplifyTrackIndices(coordinates, toleranceMeters)) {
    const position = coordinates[index]
    if (position) kept.push(position)
  }
  return kept
}

/** Indices kept by `simplifyTrackMeters`, in order. Use them to remap gap indices. */
export function simplifyTrackIndices(coordinates: Position[], toleranceMeters: number): number[] {
  const count = coordinates.length
  if (count <= 2) return Array.from({ length: count }, (_, index) => index)

  const originLon = coordinates[0]?.[0] ?? 0
  const originLat = coordinates[0]?.[1] ?? 0
  const cosOriginLat = Math.cos(originLat * RADIANS_PER_DEGREE)
  const xs = new Float64Array(count)
  const ys = new Float64Array(count)
  for (let index = 0; index < count; index += 1) {
    const lon = coordinates[index]?.[0] ?? originLon
    const lat = coordinates[index]?.[1] ?? originLat
    xs[index] = (lon - originLon) * RADIANS_PER_DEGREE * cosOriginLat * EARTH_RADIUS_METERS
    ys[index] = (lat - originLat) * RADIANS_PER_DEGREE * EARTH_RADIUS_METERS
  }

  const keep = new Uint8Array(count)
  keep[0] = 1
  keep[count - 1] = 1

  // Explicit stack instead of recursion, so long tracks cannot overflow the call stack.
  const ranges: Array<[number, number]> = [[0, count - 1]]
  let range = ranges.pop()
  while (range) {
    const [start, end] = range
    let farthest = -1
    let farthestDistance = 0
    for (let index = start + 1; index < end; index += 1) {
      const distance = distanceToSegmentMeters(xs, ys, index, start, end)
      if (distance > farthestDistance) {
        farthest = index
        farthestDistance = distance
      }
    }
    if (farthest !== -1 && farthestDistance > toleranceMeters) {
      keep[farthest] = 1
      ranges.push([start, farthest], [farthest, end])
    }
    range = ranges.pop()
  }

  const indices: number[] = []
  for (let index = 0; index < count; index += 1) {
    if (keep[index]) indices.push(index)
  }
  return indices
}

function distanceToSegmentMeters(
  xs: Float64Array,
  ys: Float64Array,
  point: number,
  start: number,
  end: number,
) {
  const startX = xs[start] ?? 0
  const startY = ys[start] ?? 0
  const dx = (xs[end] ?? 0) - startX
  const dy = (ys[end] ?? 0) - startY
  const lengthSquared = dx * dx + dy * dy

  let t = 0
  if (lengthSquared > 0) {
    t = ((xs[point] ?? 0) - startX) * dx + ((ys[point] ?? 0) - startY) * dy
    t = Math.min(1, Math.max(0, t / lengthSquared))
  }

  return Math.hypot(startX + t * dx - (xs[point] ?? 0), startY + t * dy - (ys[point] ?? 0))
}
