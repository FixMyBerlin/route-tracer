import { haversineMeters } from '@/shared/routing/nearest-road-point'

export type RouteEnd = 'start' | 'end'

/**
 * Which finished-route endpoint a click is on. When both ends are in range
 * (very short route), the closer one wins.
 */
export function pickRouteEndToResume(
  waypoints: { lon: number; lat: number }[],
  lon: number,
  lat: number,
  maxMeters: number,
): RouteEnd | null {
  const start = waypoints[0]
  const end = waypoints.at(-1)
  if (!start || !end) return null

  const distStart = haversineMeters(lat, lon, start.lat, start.lon)
  const distEnd = haversineMeters(lat, lon, end.lat, end.lon)
  const startHit = distStart <= maxMeters
  const endHit = distEnd <= maxMeters
  if (!startHit && !endHit) return null
  if (startHit && endHit) return distStart <= distEnd ? 'start' : 'end'
  return startHit ? 'start' : 'end'
}

/** Reverse the waypoint list when resuming from the start so extend-from-end still works. */
export function waypointsStartingFromEnd<T>(waypoints: T[], end: RouteEnd): T[] {
  return end === 'start' ? waypoints.slice().reverse() : waypoints
}
