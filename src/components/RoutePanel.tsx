import { useHotkey } from '@tanstack/react-hotkeys'
import { ROUTE_SEGMENT_COLORS } from '@/shared/routing/constants'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import {
  useRouteSegments,
  useRouteSnapMode,
  useRouteUndoLength,
} from '@/shared/routing/route-store'
import {
  clearActiveRoute,
  setRouteDrawMode,
  toggleDrawThroughMode,
  undoRouteEdit,
  type RouteDrawMode,
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

const drawModes: {
  value: RouteDrawMode
  label: string
  dashed?: boolean
}[] = [
  {
    value: 'snapped',
    label: 'Route snapping',
  },
  {
    value: 'freehand',
    label: 'Freehand drawing',
    dashed: true,
  },
]

const switchModeKbdClass =
  'rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-slate-400'

/** Mini map line: slate stroke with light casing, solid or dashed. */
function RouteLineSwatch({ dashed }: { dashed?: boolean }) {
  const dash = dashed ? '2.5 3.5' : undefined
  return (
    <svg aria-hidden viewBox="0 0 22 8" className="h-2 w-5 shrink-0">
      <line
        x1="3"
        y1="4"
        x2="19"
        y2="4"
        stroke="#f8fafc"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
      <line
        x1="3"
        y1="4"
        x2="19"
        y2="4"
        stroke={ROUTE_SEGMENT_COLORS.snapped}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  )
}

export function RoutePanel() {
  const { updateSearch } = useIndexSearchNavigation()
  const segments = useRouteSegments()
  const snapMode = useRouteSnapMode()
  const undoLength = useRouteUndoLength()
  const { graphReady } = useRoutingReadiness()
  const clearRouteFromUrl = useClearRouteFromUrl()
  const drawMode: RouteDrawMode = snapMode ? 'snapped' : 'freehand'

  useHotkey('S', () => toggleDrawThroughMode(), {
    enabled: graphReady,
    ignoreInputs: true,
  })

  const handleClearRoute = () => {
    clearActiveRoute()
    clearRouteFromUrl()
  }

  const totalMeters = segments.reduce(
    (sum, segment) => sum + segmentLengthMeters(segment.coordinates as [number, number][]),
    0,
  )

  return (
    <>
      <section className="border-b border-slate-800 py-5">
        <h2 className="text-sm font-medium text-white">Draw route</h2>

        <fieldset className="mt-4" disabled={!graphReady}>
          <legend className="sr-only">Draw mode</legend>
          <div className="space-y-2" role="radiogroup" aria-label="Route draw mode">
            {drawModes.map((option) => {
              const isActive = drawMode === option.value
              const showSwitchHint = graphReady && !isActive
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-400"
                >
                  <input
                    type="radio"
                    name="route-draw-mode"
                    className="border-slate-700 bg-slate-900 text-sky-500"
                    checked={isActive}
                    disabled={!graphReady}
                    onChange={() => setRouteDrawMode(option.value)}
                  />
                  <RouteLineSwatch dashed={option.dashed} />
                  <span className="min-w-0 flex-1">{option.label}</span>
                  {showSwitchHint ? (
                    <kbd className={switchModeKbdClass} title="Press S to switch to this mode">
                      S
                    </kbd>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>
      </section>

      <section className="border-b border-slate-800 py-5 last:border-b-0">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-medium text-white">Your Route</h2>
          {segments.length > 0 ? (
            <span className="shrink-0 text-xs text-slate-400">{Math.round(totalMeters)} m</span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-40"
            disabled={!graphReady || undoLength === 0}
            onClick={() => undoRouteEdit()}
          >
            Undo
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 disabled:opacity-40"
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
                <span className="text-slate-400">
                  {segment.segment_index + 1}.{' '}
                  {segment.segment_kind === 'snapped' ? 'Snapped' : 'Freehand'}
                </span>
                <span
                  className="size-2.5 rounded-full border-2 border-white bg-slate-950"
                  aria-hidden
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No route segments yet.</p>
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
    </>
  )
}
