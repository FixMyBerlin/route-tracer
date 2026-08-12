import { cn } from '@/shared/cn'
import { viewMinZoom } from '@/shared/routing/constants'
import { useIsOsmCoverageFetching } from '@/shared/routing/osm-coverage-query'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import {
  NETWORK_HIGHLIGHT_COLORS,
  type NetworkHighlightMode,
  useNetworkHighlight,
  useRoutingUiActions,
  useShowCoverageDebug,
} from '@/shared/routing/routing-ui-store'

type RoutingStatusPanelProps = {
  zoom: number
}

const highlightOptions: {
  value: NetworkHighlightMode
  label: string
  swatch?: string
}[] = [
  { value: 'invisible', label: 'Routes invisible' },
  {
    value: 'overpass',
    label: 'Highlight Overpass ways',
    swatch: NETWORK_HIGHLIGHT_COLORS.overpass,
  },
  {
    value: 'routing',
    label: 'Highlight routing network',
    swatch: NETWORK_HIGHLIGHT_COLORS.routing,
  },
]

export function RoutingStatusPanel({ zoom }: RoutingStatusPanelProps) {
  const showCoverageDebug = useShowCoverageDebug()
  const networkHighlight = useNetworkHighlight()
  const { setShowCoverageDebug, setNetworkHighlight } = useRoutingUiActions()
  const isFetching = useIsOsmCoverageFetching()
  const { wayCount, edgeCount, graphReady, graphBuilding, graphError } = useRoutingReadiness()

  let status = 'Pan the map to load OSM highways.'
  let tone: 'muted' | 'loading' | 'ready' | 'error' = 'muted'

  if (zoom < viewMinZoom) {
    status = 'Zoom in to load OSM'
  } else if (isFetching || graphBuilding) {
    status = 'Loading OSM…'
    tone = 'loading'
  } else if (graphError) {
    status = `Routing graph failed: ${graphError}`
    tone = 'error'
  } else if (graphReady) {
    status = 'Routing graph ready'
    tone = 'ready'
  } else if (wayCount > 0) {
    status = 'Building routing graph…'
    tone = 'loading'
  }

  return (
    <section className="border-b border-slate-800 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-white">Routing</h2>
          <p
            className={cn(
              'mt-2 text-sm leading-6',
              tone === 'ready' && 'text-emerald-400',
              tone === 'loading' && 'text-sky-300',
              tone === 'error' && 'text-rose-300',
              tone === 'muted' && 'text-slate-400',
            )}
          >
            {status}
          </p>
        </div>
        {(tone === 'loading' || graphBuilding) && (
          <span
            aria-hidden
            className="mt-1 size-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"
          />
        )}
      </div>

      <dl className="mt-4 space-y-1.5 text-xs text-slate-400">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-0.5 w-3 rounded-full"
              style={{ backgroundColor: NETWORK_HIGHLIGHT_COLORS.overpass }}
            />
            Overpass cache
          </dt>
          <dd className="font-medium text-slate-200">
            {wayCount} {wayCount === 1 ? 'way' : 'ways'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-0.5 w-3 rounded-full"
              style={{ backgroundColor: NETWORK_HIGHLIGHT_COLORS.routing }}
            />
            Routing graph
          </dt>
          <dd className="font-medium text-slate-200">
            {edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}
          </dd>
        </div>
      </dl>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-slate-400">Network style</legend>
        <div className="mt-2 space-y-2" role="radiogroup" aria-label="Network highlight style">
          {highlightOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 text-xs text-slate-300"
            >
              <input
                type="radio"
                name="network-highlight"
                className="border-slate-700 bg-slate-900 text-sky-500"
                checked={networkHighlight === option.value}
                onChange={() => setNetworkHighlight(option.value)}
              />
              {option.swatch ? (
                <span
                  aria-hidden
                  className="inline-block h-1 w-4 shrink-0 rounded-full"
                  style={{ backgroundColor: option.swatch }}
                />
              ) : (
                <span
                  aria-hidden
                  className="inline-block h-1 w-4 shrink-0 rounded-full bg-slate-700"
                />
              )}
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          className="rounded border-slate-700 bg-slate-900 text-sky-500"
          checked={showCoverageDebug}
          onChange={(event) => setShowCoverageDebug(event.target.checked)}
        />
        Show coverage outline (debug)
      </label>
    </section>
  )
}
