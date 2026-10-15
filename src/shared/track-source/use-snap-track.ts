import { useState } from 'react'
import { matchTrack } from '@/shared/routing/auto-snap/match-track'
import { createPointIndex } from '@/shared/routing/auto-snap/point-index'
import { getRouteEngine } from '@/shared/routing/route-engine'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'
import { getRouteState } from '@/shared/routing/route-store'
import { useApplyRoute } from '@/shared/routing/use-apply-route'
import type { LoadedTrack } from '@/shared/track-source/loaded-track'

/** Let React paint "Snapping…" before the matcher blocks the main thread. */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))

/**
 * Match the uploaded track onto the loaded roads and make the result the route.
 * `keepPinned` snaps again but keeps every waypoint the user placed or moved.
 */
export function useSnapTrack() {
  const graphBytes = useRouteSnapperGraphQuery().data?.graphBytes ?? null
  const applyRoute = useApplyRoute()
  const [snapping, setSnapping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function snapTrack(track: LoadedTrack, { keepPinned }: { keepPinned: boolean }) {
    if (!graphBytes) return
    setSnapping(true)
    setError(null)
    try {
      await nextFrame()
      const engine = await getRouteEngine(graphBytes)
      const nodes = createPointIndex(engine.snappableNodes())
      const waypoints = matchTrack({
        parts: track.parts,
        nearestNode: (position, maxMeters) => nodes.nearest(position, maxMeters)?.position ?? null,
        route: (list) => engine.route(list)?.coordinates ?? null,
        pinned: keepPinned ? getRouteState().waypoints.filter((waypoint) => waypoint.pinned) : [],
      })

      applyRoute(waypoints)
    } catch (cause) {
      console.error(cause)
      setError('Snapping failed. Try loading the roads along the track again.')
    }
    // Not in `finally`: the React Compiler skips hooks that use it.
    setSnapping(false)
  }

  return { snapTrack, snapping, error, ready: graphBytes != null }
}
