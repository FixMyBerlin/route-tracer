import { useMemo } from 'react'
import { findTrackMismatches } from '@/shared/routing/auto-snap/compare-route-to-track'
import type { ReviewItem } from '@/shared/routing/review-item'
import { useRouteLine, useRouteSegments } from '@/shared/routing/route-store'
import { useAcceptedReviewIds, useTrack } from '@/shared/track-source/track-store'

/**
 * Places where the route and the uploaded track disagree, worked out from the route as it is
 * now — fix a place and it drops off the list by itself. Freehand stretches are listed too:
 * they are where snapping found no road.
 */
export function useTrackReview() {
  const track = useTrack()
  const routeLine = useRouteLine()
  const segments = useRouteSegments()
  const accepted = useAcceptedReviewIds()

  const mismatches = useMemo(
    () => (track && routeLine.length >= 2 ? findTrackMismatches(track.line, routeLine) : []),
    [track, routeLine],
  )

  const items: ReviewItem[] = [
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

  return {
    open: items.filter((item) => !accepted.includes(item.id)),
    acceptedCount: items.length - items.filter((item) => !accepted.includes(item.id)).length,
  }
}
