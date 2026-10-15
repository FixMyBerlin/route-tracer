import { useState } from 'react'
import { pathLengthMeters } from '@/shared/routing/haversine'
import { downloadRouteGeoJson } from '@/shared/routing/route-export'
import { useRouteSegments, useRouteWaypoints } from '@/shared/routing/route-store'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { useRebuildRouteGeometry } from '@/shared/routing/use-rebuild-route-geometry'
import { useTrack } from '@/shared/track-source/track-store'

function fileNameFor(name: string | undefined) {
  const slug = name
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'route'}.geojson`
}

export function ExportPanel() {
  const segments = useRouteSegments()
  const waypoints = useRouteWaypoints()
  const track = useTrack()
  const { updateSearch } = useIndexSearchNavigation()
  const { waitingForRoads } = useRebuildRouteGeometry()
  const [simplifyGeometry, setSimplifyGeometry] = useState(true)
  const [includeTrack, setIncludeTrack] = useState(true)

  const totalMeters = segments.reduce(
    (sum, segment) => sum + pathLengthMeters(segment.coordinates),
    0,
  )

  return (
    <section className="py-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-white">Export</h2>
        {segments.length > 0 ? (
          <span className="shrink-0 text-xs text-slate-400">
            {Math.round(totalMeters)} m · {segments.length}{' '}
            {segments.length === 1 ? 'segment' : 'segments'}
          </span>
        ) : null}
      </div>

      {waitingForRoads ? (
        <p className="mt-2 text-sm leading-tight text-amber-400" role="status">
          This route still has to be drawn on the roads.{' '}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-amber-300"
            onClick={() => updateSearch({ step: 'tracing' })}
          >
            Load the roads under it
          </button>{' '}
          first.
        </p>
      ) : null}

      <label
        className="mt-4 flex cursor-pointer items-center gap-2 text-sm leading-none text-slate-400"
        title="Drop densified nodes added for mid-block snapping"
      >
        <input
          type="checkbox"
          className="rounded border-slate-700 bg-slate-900 text-sky-500"
          checked={simplifyGeometry}
          onChange={(event) => setSimplifyGeometry(event.target.checked)}
        />
        Simplify geometry
      </label>
      {track ? (
        <label
          className="mt-3 flex cursor-pointer items-center gap-2 text-sm leading-none text-slate-400"
          title="Adds the uploaded track as a MultiLineString, so the file can be snapped again later"
        >
          <input
            type="checkbox"
            className="rounded border-slate-700 bg-slate-900 text-sky-500"
            checked={includeTrack}
            onChange={(event) => setIncludeTrack(event.target.checked)}
          />
          Include the GPS track
        </label>
      ) : null}
      <button
        type="button"
        className="mt-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        disabled={segments.length === 0}
        onClick={() =>
          downloadRouteGeoJson(segments, {
            simplify: simplifyGeometry,
            waypoints,
            ...(track && includeTrack ? { track } : {}),
            filename: fileNameFor(track?.name),
          })
        }
      >
        Download GeoJSON
      </button>
      <p className="mt-3 text-xs leading-tight text-slate-500">
        The file also holds the route’s points{track && includeTrack ? ' and your track' : ''}. Drop
        it into “Snap a track” to open the route again.
      </p>
    </section>
  )
}
