import { cn } from '@/shared/cn'
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

  const handleExport = () => {
    if (segments.length === 0) return
    downloadRouteGeoJson(segments)
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
  }

  const totalMeters = segments.reduce(
    (sum, segment) => sum + segmentLengthMeters(segment.coordinates as [number, number][]),
    0,
  )

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-950/70 p-4',
        'shadow-sm shadow-black/20',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-white">Export</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Download a GeoJSON FeatureCollection with one LineString per segment.
          </p>
        </div>
        {segments.length > 0 ? (
          <span className="shrink-0 rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
            {Math.round(totalMeters)} m · {segments.length}{' '}
            {segments.length === 1 ? 'segment' : 'segments'}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        disabled={segments.length === 0}
        onClick={handleExport}
      >
        Download GeoJSON
      </button>
      <button
        type="button"
        className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        disabled={segments.length === 0}
        onClick={() => void handleCopyLink()}
      >
        Copy shareable link
      </button>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Route geometry is already encoded in the URL. Reload or share the address bar link.
      </p>
    </section>
  )
}
