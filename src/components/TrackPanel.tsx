import { useRef, useState } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { twJoin } from 'tailwind-merge'
import { fitMapToLine } from '@/shared/map/fit-map-to-line'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import { useRouteWaypoints } from '@/shared/routing/route-store'
import { useLoadRoadsAlongLine } from '@/shared/routing/use-load-roads-along-line'
import type { LoadedTrack } from '@/shared/track-source/loaded-track'
import { useTrack, useTrackError, useTrackRestoreStatus } from '@/shared/track-source/track-store'
import { useSnapTrack } from '@/shared/track-source/use-snap-track'

type TrackPanelProps = {
  onTrackFile: (file: File) => Promise<LoadedTrack | null>
}

function formatKilometers(meters: number) {
  return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`
}

const emptyLine: LoadedTrack['line'] = []

export function TrackPanel({ onTrackFile }: TrackPanelProps) {
  const track = useTrack()
  const error = useTrackError()
  const restoreStatus = useTrackRestoreStatus()
  const { mainMap } = useMap()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const roads = useLoadRoadsAlongLine(track?.line ?? emptyLine)
  const { graphBuilding } = useRoutingReadiness()
  const { snapTrack, snapping, error: snapError, ready } = useSnapTrack()
  const pinnedCount = useRouteWaypoints().filter((waypoint) => waypoint.pinned).length

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    await onTrackFile(file)
  }

  const canSnap = track != null && roads.missingCount === 0 && ready && !graphBuilding
  const snapLabel = snapping ? 'Snapping…' : 'Snap to roads'

  return (
    <>
      <section className="border-b border-slate-800 py-5">
        <h2 className="text-sm font-medium text-white">Track</h2>
        {restoreStatus === 'missing' ? (
          <p className="mt-2 text-sm leading-tight text-amber-400" role="status">
            The track for this link is stored in another browser or has expired. Upload it again to
            snap it anew; the route itself is still in the link.
          </p>
        ) : null}

        {track ? (
          <div className="mt-3 rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
            <p className="truncate font-medium text-slate-200" title={track.fileName}>
              {track.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {formatKilometers(track.lengthMeters)}
              {track.parts.length > 1 ? ` · ${track.parts.length} parts, joined in file order` : ''}
            </p>
            <button
              type="button"
              className="mt-1 text-xs text-sky-300 underline underline-offset-2 hover:text-sky-200"
              onClick={() => fitMapToLine(mainMap?.getMap(), track.line)}
            >
              Show the whole track
            </button>
          </div>
        ) : null}

        <div
          className={twJoin(
            'mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-sm',
            dragActive ? 'border-sky-400 bg-sky-950/40' : 'border-slate-700',
          )}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            setDragActive(false)
            void handleFile(event.dataTransfer.files[0])
          }}
        >
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800"
            onClick={() => fileInputRef.current?.click()}
          >
            {track ? 'Choose another file' : 'Choose a GPX or GeoJSON file'}
          </button>
          <p className="mt-2 text-xs text-slate-500">or drop it here or on the map</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,.geojson,.json,application/gpx+xml,application/geo+json,application/json"
            className="sr-only"
            data-testid="track-file-input"
            onChange={(event) => {
              void handleFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
        {error ? (
          <p className="mt-2 text-sm leading-tight text-amber-400" role="alert">
            {error}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-tight text-slate-500">
          The file stays in this browser. Links you share carry the snapped route, not the track.
        </p>
      </section>

      {track ? (
        <section className="py-5">
          <h2 className="text-sm font-medium text-white">Snap to roads</h2>
          {roads.missingCount > 0 ? (
            <>
              <p className="mt-2 text-sm leading-tight text-slate-400">
                Snapping needs the roads along the track:{' '}
                {roads.missingCount === 1 ? 'one area' : `${roads.missingCount} areas`} still to
                load.
              </p>
              <button
                type="button"
                className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                disabled={roads.loading}
                onClick={() => void roads.load()}
              >
                {roads.progress
                  ? `Loading ${roads.progress.done + 1} of ${roads.progress.total}…`
                  : 'Load roads along the track'}
              </button>
              {roads.error ? (
                <p className="mt-2 text-sm leading-tight text-amber-400" role="alert">
                  {roads.error}
                </p>
              ) : null}
              <p className="mt-3 text-xs leading-tight text-slate-500">
                Every area you load puts work on a community-run server. Please be mindful and load
                only what you need.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-tight text-slate-400">
              Roads along the track are loaded. Snapping puts a point about every 150 m on the
              nearest road and follows your track freehand where no road is near.
            </p>
          )}

          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            disabled={!canSnap || snapping}
            onClick={() => void snapTrack(track, { keepPinned: false })}
          >
            {snapLabel}
          </button>
          {snapError ? (
            <p className="mt-2 text-sm leading-tight text-amber-400" role="alert">
              {snapError}
            </p>
          ) : null}
          {pinnedCount > 0 ? (
            <button
              type="button"
              className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              disabled={!canSnap || snapping}
              onClick={() => void snapTrack(track, { keepPinned: true })}
            >
              Snap again, keep my {pinnedCount} {pinnedCount === 1 ? 'point' : 'points'}
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
