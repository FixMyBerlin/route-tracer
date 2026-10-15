/**
 * A route waypoint plus who decided it.
 * `pinned` waypoints were placed or moved by the user and survive a re-match from the source
 * track; unpinned ones came from auto-snap and may be recomputed.
 */
export type FlaggedWaypoint = {
  lon: number
  lat: number
  snapped: boolean
  pinned: boolean
}
