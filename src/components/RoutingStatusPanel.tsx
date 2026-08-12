import { cn } from '@/shared/cn'
import { viewMinZoom } from '@/shared/routing/constants'
import { useIsOsmCoverageFetching } from '@/shared/routing/osm-coverage-query'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import { useRoutingUiActions, useShowCoverageDebug } from '@/shared/routing/routing-ui-store'

type RoutingStatusPanelProps = {
  zoom: number
}

export function RoutingStatusPanel({ zoom }: RoutingStatusPanelProps) {
  const showCoverageDebug = useShowCoverageDebug()
  const { setShowCoverageDebug } = useRoutingUiActions()
  const isFetching = useIsOsmCoverageFetching()
  const { wayCount, graphReady, graphBuilding, graphError } = useRoutingReadiness()

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
    status = `Routing graph ready (${wayCount} ways)`
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
