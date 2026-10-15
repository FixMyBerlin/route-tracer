import type { Position } from 'geojson'
import { maxDeviationMeters } from '@/shared/routing/auto-snap/line-deviation'

export type MinimizeOptions<T> = {
  /** Waypoints that must stay (pinned, freehand, ...). First and last always stay. */
  isFixed: (waypoint: T) => boolean
  /** Route geometry through the given waypoints (in order), or null if no route. */
  route: (waypoints: T[]) => Position[] | null
  /** Default: maxDeviationMeters(a, b) <= 1 */
  sameRoute?: (a: Position[], b: Position[]) => boolean
}

const defaultSameRoute = (a: Position[], b: Position[]) => maxDeviationMeters(a, b) <= 1

/**
 * Greedily drops removable waypoints while the route stays the same. Each candidate is judged
 * locally: the route from the last kept waypoint straight to the next one must match the route
 * that goes through the candidate. If either route is missing, the candidate is kept.
 * Returns the kept waypoints in order, as the same object references.
 */
export function minimizeWaypoints<T>(waypoints: T[], options: MinimizeOptions<T>): T[] {
  const { isFixed, route, sameRoute = defaultSameRoute } = options
  if (waypoints.length <= 2) return [...waypoints]

  const kept: T[] = [waypoints[0] as T]
  for (let index = 1; index < waypoints.length - 1; index += 1) {
    const candidate = waypoints[index] as T
    const next = waypoints[index + 1] as T
    const lastKept = kept.at(-1) as T

    if (isFixed(candidate)) {
      kept.push(candidate)
      continue
    }

    const without = route([lastKept, next])
    const withCandidate = without ? route([lastKept, candidate, next]) : null
    if (without && withCandidate && sameRoute(without, withCandidate)) continue
    kept.push(candidate)
  }
  kept.push(waypoints.at(-1) as T)
  return kept
}
