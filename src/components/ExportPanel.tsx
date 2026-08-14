import { useState } from 'react'
import { downloadRouteGeoJson } from '@/shared/routing/route-segments'
import { useRouteSegments } from '@/shared/routing/route-store'

function segmentLengthMeters(coordinates: [number, number][]) {
  let length = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1]
    const current = coordinates[index]
    if (!previous || !current) continue
    const [lng1, lat1] = previous
    const [lng2, lat2] = current
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180
    const earthRadiusMeters = 6_371_000
    const dLat = toRadians(lat2 - lat1)
    const dLng = toRadians(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
    length += 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
  }
  return length
}

export function ExportPanel() {
  const segments = useRouteSegments()
  const [simplifyGeometry, setSimplifyGeometry] = useState(true)

  const handleExport = () => {
    if (segments.length === 0) return
    downloadRouteGeoJson(segments, { simplify: simplifyGeometry })
  }

  const totalMeters = segments.reduce(
    (sum, segment) => sum + segmentLengthMeters(segment.coordinates as [number, number][]),
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
        onClick={handleExport}
      >
        Download GeoJSON
      </button>
    </section>
  )
}
