import { useHotkey } from '@tanstack/react-hotkeys'
import { useEffect, useState } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { ReviewItemList } from '@/components/ReviewItemList'
import { fitMapToLine } from '@/shared/map/fit-map-to-line'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import { useRouteWaypoints } from '@/shared/routing/route-store'
import { useLoadRoadsAlongLine } from '@/shared/routing/use-load-roads-along-line'
import type { LoadedTrack } from '@/shared/track-source/loaded-track'
import { useTrack } from '@/shared/track-source/track-store'
import { useSnapTrack } from '@/shared/track-source/use-snap-track'
import {
  dropStaleReviewChecks,
  useCheckReviewItem,
  useTrackReview,
} from '@/shared/track-source/use-track-review'

const emptyLine: LoadedTrack['line'] = []

const kbdClass =
  'rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-slate-400'

/** What auto-snap may have got wrong, as a checklist. N jumps to the next open place. */
export function TrackReviewPanel() {
  const track = useTrack()
  const { open, total, checked, stale } = useTrackReview()
  const [saveFailed, setSaveFailed] = useState(false)
  const checkItem = useCheckReviewItem(() => setSaveFailed(true))
  const { mainMap } = useMap()
  const [cursor, setCursor] = useState(0)
  const { snapTrack, snapping, error: snapError, ready } = useSnapTrack()
  const roads = useLoadRoadsAlongLine(track?.line ?? emptyLine)
  const { graphBuilding } = useRoutingReadiness()
  const waypoints = useRouteWaypoints()
  const pinnedCount = waypoints.filter((waypoint) => waypoint.pinned).length

  useEffect(
    function dropStaleChecks() {
      if (stale.length > 0) dropStaleReviewChecks(stale)
    },
    [stale],
  )

  const showNext = () => {
    if (open.length === 0) return
    const item = open[cursor % open.length]
    if (item) fitMapToLine(mainMap?.getMap(), item.coordinates)
    setCursor((cursor % open.length) + 1)
  }

  useHotkey('N', showNext, { enabled: open.length > 0, ignoreInputs: true })

  if (!track) return null

  return (
    <section className="border-b border-slate-800 py-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-white">Check against your track</h2>
        {open.length > 0 ? (
          <span className="shrink-0 text-xs text-amber-400">
            {open.length} {open.length === 1 ? 'place' : 'places'} to check
          </span>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {checked} of {total} checked
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Places checked"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={checked}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-sky-500 transition-[width]"
              style={{ width: `${(checked / total) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {saveFailed ? (
        <p className="mt-2 text-sm leading-tight text-amber-400" role="status">
          Your checks could not be saved in this browser. They last until you reload.
        </p>
      ) : null}

      {waypoints.length < 2 ? (
        <p className="mt-2 text-sm leading-tight text-slate-400">
          There is no route to check yet. Snap the track to the roads, or draw the route yourself.
        </p>
      ) : open.length === 0 ? (
        <p className="mt-2 text-sm leading-tight text-slate-400">
          The route follows your track everywhere
          {checked > 0 ? `, apart from ${checked} you marked as right` : ''}.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-tight text-slate-400">
            Highlighted on the map. Fix a place by dragging the route; it leaves this list once the
            route matches the track. Press{' '}
            <kbd className={kbdClass} title="Show the next place to check">
              N
            </kbd>{' '}
            for the next one.
          </p>
          <ReviewItemList items={open} onAccept={(item) => checkItem(item.id)} />
        </>
      )}

      <button
        type="button"
        className="mt-4 w-full rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        disabled={snapping || !ready || graphBuilding || roads.missingCount > 0}
        title="Snaps the track onto the roads again; points you placed or moved stay. Undo brings the current route back."
        onClick={() => void snapTrack(track, { keepPinned: true })}
      >
        {snapping
          ? 'Snapping…'
          : waypoints.length < 2
            ? 'Snap to roads'
            : pinnedCount > 0
              ? `Snap again, keep my ${pinnedCount} ${pinnedCount === 1 ? 'point' : 'points'}`
              : 'Snap again'}
      </button>
      {snapError ? (
        <p className="mt-2 text-sm leading-tight text-amber-400" role="alert">
          {snapError}
        </p>
      ) : null}
    </section>
  )
}
