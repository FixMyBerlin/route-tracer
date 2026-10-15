import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import { haversineMeters } from '@/shared/routing/haversine'

type PlainWaypoint = { lon: number; lat: number; snapped: boolean }

/**
 * After an edit, decides `pinned` for each new waypoint. A waypoint that matches an unused
 * previous waypoint (same `snapped`, within `toleranceMeters`) keeps that waypoint's `pinned`.
 * Anything else was created or moved by the user, so it becomes pinned.
 * Matching is greedy in order: candidates after the last matched index are tried first, then
 * the rest from the start.
 */
export function carryPinnedFlags(
  previous: FlaggedWaypoint[],
  next: PlainWaypoint[],
  toleranceMeters = 0.5,
): FlaggedWaypoint[] {
  const indices = previous.map((_, index) => index)
  const used = previous.map(() => false)
  let lastMatched = -1

  return next.map((waypoint) => {
    const order = [
      ...indices.filter((index) => index > lastMatched),
      ...indices.filter((index) => index <= lastMatched),
    ]
    const match = order.find((index) => {
      const candidate = previous[index]
      return (
        candidate !== undefined &&
        !used[index] &&
        candidate.snapped === waypoint.snapped &&
        haversineMeters(candidate.lat, candidate.lon, waypoint.lat, waypoint.lon) <= toleranceMeters
      )
    })

    if (match === undefined) return { ...waypoint, pinned: true }

    used[match] = true
    lastMatched = match
    return { ...waypoint, pinned: previous[match]?.pinned ?? true }
  })
}
