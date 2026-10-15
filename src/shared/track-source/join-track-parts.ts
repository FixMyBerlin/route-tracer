import type { Position } from 'geojson'
import { haversineMeters } from '@/shared/routing/haversine'

export type JoinedTrack = {
  coordinates: Position[]
  /** Index ranges in `coordinates` where two parts were bridged by a straight gap: [lastIndexOfPartA, firstIndexOfPartB]. */
  gaps: Array<[number, number]>
}

/** Parts whose end and next start are this close are treated as one continuous line. */
const TOUCH_TOLERANCE_METERS = 1

/**
 * Joins parts in file order into one line. A part whose end equals (within 1 m) the next part's
 * start is merged without a gap. Parts are never reordered or reversed.
 */
export function joinTrackParts(parts: Position[][]): JoinedTrack {
  const coordinates: Position[] = []
  const gaps: Array<[number, number]> = []

  for (const part of parts) {
    if (part.length === 0) continue

    const previous = coordinates.at(-1)
    const first = part[0]
    let start = 0

    if (previous && first) {
      const touching =
        haversineMeters(previous[1] ?? 0, previous[0] ?? 0, first[1] ?? 0, first[0] ?? 0) <=
        TOUCH_TOLERANCE_METERS
      if (touching) start = 1
      else gaps.push([coordinates.length - 1, coordinates.length])
    }

    for (let index = start; index < part.length; index += 1) {
      const position = part[index]
      if (position) coordinates.push(position)
    }
  }

  return { coordinates, gaps }
}
