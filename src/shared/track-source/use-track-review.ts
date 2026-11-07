import { useMemo } from 'react'
import { findTrackMismatches } from '@/shared/routing/auto-snap/compare-route-to-track'
import type { ReviewItem } from '@/shared/routing/review-item'
import type { RouteSegment } from '@/shared/routing/route-segments'
import { useRouteLine, useRouteSegments } from '@/shared/routing/route-store'
import type { LoadedTrack } from '@/shared/track-source/loaded-track'
import { putAcceptedReviewIds } from '@/shared/track-source/track-idb'
import {
  getTrackState,
  useAcceptedReviewIds,
  useTrack,
  useTrackActions,
} from '@/shared/track-source/track-store'

/**
 * Places where the route and the uploaded track disagree, worked out from the route as it is
 * now — fix a place and it drops off the list by itself. Freehand stretches are listed too:
 * they are where snapping found no road.
 *
 * Ids: mismatches are named by where they start along the track (stable while the track is the
 * same); freehand stretches by where they start on the map (stable while their start point is).
 */
function reviewItemsFor(
  track: LoadedTrack | null,
  routeLine: LoadedTrack['line'],
  segments: RouteSegment[],
): ReviewItem[] {
  const mismatches = track && routeLine.length >= 2 ? findTrackMismatches(track.line, routeLine) : []
  return [
    ...mismatches.map(
      (mismatch): ReviewItem => ({
        id: mismatch.id,
        kind: 'off-track',
        title: `Route is up to ${Math.round(mismatch.maxDistanceMeters)} m away from your track`,
        coordinates: mismatch.coordinates,
      }),
    ),
    ...(track
      ? segments
          .filter((segment) => segment.segment_kind === 'manual')
          .map((segment): ReviewItem => {
            const [lon = 0, lat = 0] = segment.coordinates[0] ?? []
            return {
              id: `f-${lon.toFixed(4)},${lat.toFixed(4)}`,
              kind: 'freehand',
              title: 'No road nearby — drawn freehand along your track',
              coordinates: segment.coordinates,
            }
          })
      : []),
  ]
}

export function useTrackReview() {
  const track = useTrack()
  const routeLine = useRouteLine()
  const segments = useRouteSegments()
  const accepted = useAcceptedReviewIds()

  const items = useMemo(
    () => reviewItemsFor(track, routeLine, segments),
    [track, routeLine, segments],
  )

  const open = items.filter((item) => !accepted.includes(item.id))
  const checked = items.length - open.length

  // Marks whose place is gone: fixed, or moved by a new route. Only judged once the route is
  // drawn, because before that no places are listed at all.
  const stale = useMemo(() => {
    if (!track || routeLine.length < 2) return []
    const current = new Set(items.map((item) => item.id))
    return accepted.filter((id) => !current.has(id))
  }, [track, routeLine, items, accepted])

  return { open, total: items.length, checked, stale }
}

/** Marks a place as right, in memory and with the stored track. */
export function useCheckReviewItem(onSaveError: () => void) {
  const { acceptReview } = useTrackActions()

  return (id: string) => {
    acceptReview(id)
    const { track, acceptedReviewIds } = getTrackState()
    if (!track) return
    // The mark still holds for this session; only a reload would lose it.
    void putAcceptedReviewIds(track.id, acceptedReviewIds).catch(onSaveError)
  }
}

/** Forgets marks for places that are gone, in memory and with the stored track. */
export function dropStaleReviewChecks(stale: string[]) {
  const { track, acceptedReviewIds, actions } = getTrackState()
  const kept = acceptedReviewIds.filter((id) => !stale.includes(id))
  if (kept.length === acceptedReviewIds.length) return
  actions.setAcceptedReviewIds(kept)
  if (track) void putAcceptedReviewIds(track.id, kept).catch(() => undefined)
}
