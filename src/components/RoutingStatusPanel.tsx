import { formatCoverageAgeHour } from '@osm-editor-kit/osm-coverage'
import { useQueryClient } from '@tanstack/react-query'
import { useMap } from 'react-map-gl/maplibre'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { NETWORK_HIGHLIGHT_COLORS, viewMinZoom } from '@/shared/routing/constants'
import { scheduleCoverageFromMap } from '@/shared/routing/map-helpers'
import {
  useOsmCoveragePrefsActions,
  useOsmPreferFresh,
} from '@/shared/routing/osm-coverage-prefs-store'
import {
  clearPersistedOsmCoverage,
  emptyOsmCoverageData,
  osmCoverageSessionKey,
  useIsOsmCoverageFetching,
  useOsmCoverageFetch,
  useOsmCoverageQuery,
} from '@/shared/routing/osm-coverage-query'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import type { NetworkHighlightMode } from '@/shared/routing/search-schema'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'

type RoutingStatusPanelProps = {
  zoom: number
}

const highlightOptions: {
  value: NetworkHighlightMode
  label: string
  swatch?: string
  dashed?: boolean
}[] = [
  { value: 'invisible', label: 'Network hidden' },
  {
    value: 'overpass',
    label: 'Overpass ways (under streets)',
    swatch: NETWORK_HIGHLIGHT_COLORS.overpass,
  },
  {
    value: 'routing',
    label: 'Routing graph (black dotted)',
    swatch: NETWORK_HIGHLIGHT_COLORS.routing,
    dashed: true,
  },
]

export function RoutingStatusPanel({ zoom }: RoutingStatusPanelProps) {
  const coverageDebug = Route.useSearch({ select: (search) => search.coverageDebug })
  const network = Route.useSearch({ select: (search) => search.network })
  const { updateSearch } = useIndexSearchNavigation()
  const isFetching = useIsOsmCoverageFetching()
  const { wayCount, edgeCount, graphReady, graphBuilding, graphError } = useRoutingReadiness()
  const savedAt = useOsmCoverageQuery({ select: (data) => data.savedAt })
  const ageLabel = formatCoverageAgeHour(savedAt.data ?? null)
  const preferFresh = useOsmPreferFresh()
  const { setPreferFresh } = useOsmCoveragePrefsActions()
  const queryClient = useQueryClient()
  const { mainMap } = useMap()
  const { loadOsmData, isFetching: coverageBusy } = useOsmCoverageFetch()

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

  async function reloadViewport(options?: { force?: boolean; clearPersistedOnForce?: boolean }) {
    const map = mainMap?.getMap()
    if (!map) return
    const args = scheduleCoverageFromMap(map)
    await loadOsmData(args.bounds, args.zoom, {
      mapSizePx: args.mapSizePx,
      force: options?.force,
      clearPersistedOnForce: options?.clearPersistedOnForce,
    })
  }

  async function onPreferFreshChange(next: boolean) {
    setPreferFresh(next)
    if (!next) return
    await clearPersistedOsmCoverage({})
    queryClient.setQueryData(osmCoverageSessionKey({}), emptyOsmCoverageData())
    if (mainMap && mainMap.getMap().getZoom() >= viewMinZoom) {
      await reloadViewport({ force: true, clearPersistedOnForce: true })
    }
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
          {ageLabel ? (
            <p className="mt-1 text-xs text-slate-500">
              {preferFresh ? 'Fetching fresh OSM (cache off)' : `OSM data from ~${ageLabel}`}
            </p>
          ) : preferFresh ? (
            <p className="mt-1 text-xs text-slate-500">Fetching fresh OSM (cache off)</p>
          ) : null}
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
              className="inline-block h-0.5 w-3 border-t-2 border-dotted"
              style={{ borderColor: NETWORK_HIGHLIGHT_COLORS.routing }}
            />
            Routing graph
          </dt>
          <dd className="font-medium text-slate-200">
            {edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-left text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={zoom < viewMinZoom || coverageBusy || !mainMap}
          onClick={() => {
            void reloadViewport({ force: true, clearPersistedOnForce: true })
          }}
        >
          Reload OSM for this view
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="rounded border-slate-700 bg-slate-900 text-sky-500"
            checked={preferFresh}
            onChange={(event) => {
              void onPreferFreshChange(event.target.checked)
            }}
          />
          Always fetch fresh OSM
        </label>
      </div>

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
                checked={network === option.value}
                onChange={() => updateSearch({ network: option.value })}
              />
              {option.swatch ? (
                <span
                  aria-hidden
                  className={
                    option.dashed
                      ? 'inline-block h-0.5 w-4 shrink-0 border-t-2 border-dotted'
                      : 'inline-block h-1 w-4 shrink-0 rounded-full'
                  }
                  style={
                    option.dashed
                      ? { borderColor: option.swatch }
                      : { backgroundColor: option.swatch }
                  }
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
          checked={coverageDebug}
          onChange={(event) => updateSearch({ coverageDebug: event.target.checked })}
        />
        Show coverage outline (debug)
      </label>
    </section>
  )
}
