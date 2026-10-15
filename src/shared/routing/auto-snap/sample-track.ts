import type { Position } from 'geojson'
import { lonLatOf } from '@/shared/routing/auto-snap/local-meters'
import { haversineMeters } from '@/shared/routing/haversine'

export type TrackSample = { index: number; position: Position }

export type SampleTrackOptions = {
  spacingMeters?: number
  turnDegrees?: number
  minGapMeters?: number
}

/** Legs shorter than this are too noisy to tell a turn from jitter. */
const MIN_TURN_LEG_METERS = 5

/** Initial great-circle bearing from `from` to `to`, in degrees clockwise from north. */
function bearingDegrees(from: Position, to: Position) {
  const [lon1, lat1] = lonLatOf(from)
  const [lon2, lat2] = lonLatOf(to)
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const dLambda = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Absolute change of heading at vertex `index`, in degrees (0 to 180), or null if it cannot be judged. */
function turnAtVertex(coordinates: Position[], index: number) {
  const before = coordinates[index - 1]
  const at = coordinates[index]
  const after = coordinates[index + 1]
  if (!before || !at || !after) return null

  const [lon0, lat0] = lonLatOf(before)
  const [lon1, lat1] = lonLatOf(at)
  const [lon2, lat2] = lonLatOf(after)
  if (
    haversineMeters(lat0, lon0, lat1, lon1) < MIN_TURN_LEG_METERS ||
    haversineMeters(lat1, lon1, lat2, lon2) < MIN_TURN_LEG_METERS
  ) {
    return null
  }

  const change = Math.abs(bearingDegrees(before, at) - bearingDegrees(at, after)) % 360
  return change > 180 ? 360 - change : change
}

/**
 * Picks candidate waypoint positions along a track: the first and last vertex, a vertex each
 * time `spacingMeters` have passed since the previous sample, and every vertex where the
 * heading turns by at least `turnDegrees`. Samples closer than `minGapMeters` (along the track)
 * to the previous one are skipped, with two replacements: a corner replaces a spacing sample just
 * before it, and the last vertex replaces the previous sample. Neither replaces the first vertex.
 */
export function sampleTrack(
  coordinates: Position[],
  options: SampleTrackOptions = {},
): TrackSample[] {
  const { spacingMeters = 150, turnDegrees = 45, minGapMeters = 30 } = options
  const count = coordinates.length
  if (count < 2) return coordinates.map((position, index) => ({ index, position }))

  // Cumulative along-track distance at every vertex.
  const along = [0]
  for (let index = 1; index < count; index += 1) {
    const [lon1, lat1] = lonLatOf(coordinates[index - 1] ?? [])
    const [lon2, lat2] = lonLatOf(coordinates[index] ?? [])
    along.push((along[index - 1] ?? 0) + haversineMeters(lat1, lon1, lat2, lon2))
  }

  const picked: number[] = [0]
  const turns = new Set<number>()
  for (let index = 1; index < count - 1; index += 1) {
    const last = picked.at(-1) ?? 0
    const distanceSinceLast = (along[index] ?? 0) - (along[last] ?? 0)
    const turn = turnAtVertex(coordinates, index)
    const isTurn = turn !== null && turn >= turnDegrees
    if (!isTurn && distanceSinceLast < spacingMeters) continue
    if (distanceSinceLast < minGapMeters) {
      // A corner outranks a spacing sample just before it, so the corner replaces that sample.
      const previousIsSpacing = last !== 0 && !turns.has(last)
      if (!(isTurn && previousIsSpacing)) continue
      picked.pop()
    }
    if (isTurn) turns.add(index)
    picked.push(index)
  }

  const lastIndex = count - 1
  const previous = picked.at(-1) ?? 0
  if (previous !== 0 && (along[lastIndex] ?? 0) - (along[previous] ?? 0) < minGapMeters) {
    picked.pop()
  }
  picked.push(lastIndex)

  return picked.map((index) => ({ index, position: coordinates[index] ?? [] }))
}
