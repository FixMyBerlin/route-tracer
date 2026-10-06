import { useState } from 'react'
import { pathLengthMeters } from '@/shared/routing/haversine'
import { downloadRouteGeoJson } from '@/shared/routing/route-segments'
import { useRouteSegments } from '@/shared/routing/route-store'

export function ExportPanel() {
  const segments = useRouteSegments()
  const [simplifyGeometry, setSimplifyGeometry] = useState(true)

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
      <button
        type="button"
        className="mt-3 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        disabled={segments.length === 0}
        onClick={() => downloadRouteGeoJson(segments, { simplify: simplifyGeometry })}
      >
        Download GeoJSON
      </button>
    </section>
  )
}
