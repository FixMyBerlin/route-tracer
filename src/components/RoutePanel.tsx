import { cn } from '@/shared/cn'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import {
  useRouteSegments,
  useRouteSnapMode,
  useRouteUndoLength,
} from '@/shared/routing/route-store'
import {
  clearActiveRoute,
  toggleDrawThroughMode,
  undoRouteEdit,
} from '@/shared/routing/route-tool-controller'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { useClearRouteFromUrl } from '@/shared/routing/use-route-url-sync'

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

export function RoutePanel() {
  const { updateSearch } = useIndexSearchNavigation()
  const segments = useRouteSegments()
  const snapMode = useRouteSnapMode()
  const undoLength = useRouteUndoLength()
  const { graphReady } = useRoutingReadiness()
  const clearRouteFromUrl = useClearRouteFromUrl()
  const drawThrough = !snapMode

  const handleClearRoute = () => {
    clearActiveRoute()
    clearRouteFromUrl()
  }

  const totalMeters = segments.reduce(
    (sum, segment) => sum + segmentLengthMeters(segment.coordinates as [number, number][]),
    0,
  )

  return (
    <section className="border-b border-slate-800 py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-white">Route segments</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {graphReady
              ? 'Click waypoints on the map. Drag to adjust snapped stretches.'
              : 'Zoom in and wait for the routing graph before drawing.'}
          </p>
        </div>
        {segments.length > 0 && (
          <span className="shrink-0 text-xs text-slate-400">{Math.round(totalMeters)} m</span>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          className="rounded border-slate-700 bg-slate-900 text-sky-500"
          checked={drawThrough}
          disabled={!graphReady}
          onChange={() => toggleDrawThroughMode()}
        />
        Draw-through mode
      </label>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Sketch manual stretches where OSM cannot follow the real path. Press S to toggle.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          disabled={!graphReady || undoLength === 0}
          onClick={() => undoRouteEdit()}
        >
          Undo
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          disabled={segments.length === 0}
          onClick={handleClearRoute}
        >
          Clear route
        </button>
      </div>

      {segments.length > 0 ? (
        <ol className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
          {segments.map((segment) => (
            <li
              key={segment.segment_index}
              className="flex items-center justify-between py-2.5 text-sm"
            >
              <span className="text-slate-200">
                {segment.segment_index + 1}.{' '}
                {segment.segment_kind === 'snapped' ? 'Snapped' : 'Manual'}
              </span>
              <span
                className={cn(
                  'size-2.5 rounded-full',
                  segment.segment_kind === 'snapped' ? 'bg-sky-400' : 'bg-orange-400',
                )}
                aria-hidden
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No route segments yet.</p>
      )}

      <button
        type="button"
        className="mt-4 w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        disabled={segments.length === 0}
        onClick={() => updateSearch({ step: 'export' })}
      >
        Continue to export
      </button>
    </section>
  )
}
