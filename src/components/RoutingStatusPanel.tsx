import { formatCoverageAgeHour } from '@osm-editor-kit/osm-coverage'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceStrict } from 'date-fns'
import { useSyncExternalStore } from 'react'
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

function formatCount(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_MINUTE_MS = 60_000

function subscribeToMinuteClock(onStoreChange: () => void) {
  const intervalId = window.setInterval(onStoreChange, ONE_MINUTE_MS)
  return function stopMinuteClock() {
    window.clearInterval(intervalId)
  }
}

function getMinuteClockMs() {
  return Math.floor(Date.now() / ONE_MINUTE_MS) * ONE_MINUTE_MS
}

function useMinuteClockMs() {
  return useSyncExternalStore(subscribeToMinuteClock, getMinuteClockMs, getMinuteClockMs)
}

const highlightOptions: {
  value: NetworkHighlightMode
  label: string
  swatch?: string
}[] = [
  { value: 'invisible', label: 'Network hidden' },
  {
    value: 'overpass',
    label: 'Overpass ways',
    swatch: NETWORK_HIGHLIGHT_COLORS.overpass,
  },
  {
    value: 'routing',
    label: 'Routing graph',
    swatch: NETWORK_HIGHLIGHT_COLORS.routing,
  },
]

export function RoutingStatusPanel({ zoom }: RoutingStatusPanelProps) {
  const coverageDebug = Route.useSearch({ select: (search) => search.coverageDebug })
  const network = Route.useSearch({ select: (search) => search.network })
  const { updateSearch } = useIndexSearchNavigation()
  const isFetching = useIsOsmCoverageFetching()
  const { wayCount, edgeCount, graphReady, graphBuilding, graphError } = useRoutingReadiness()
  const savedAt = useOsmCoverageQuery({ select: (data) => data.savedAt })
  const savedAtIso = savedAt.data ?? null
  const nowMs = useMinuteClockMs()
  const ageLabel = formatCoverageAgeHour(savedAtIso, new Date(nowMs))
  const savedAtMs = savedAtIso ? Date.parse(savedAtIso) : Number.NaN
  const cacheStale = Number.isFinite(savedAtMs) && nowMs - savedAtMs > ONE_HOUR_MS
  const cacheAgeDistance = Number.isFinite(savedAtMs)
    ? formatDistanceStrict(savedAtMs, nowMs)
    : null
  const preferFresh = useOsmPreferFresh()
  const { setPreferFresh } = useOsmCoveragePrefsActions()
  const queryClient = useQueryClient()
  const { mainMap } = useMap()
  const { loadOsmData, isFetching: coverageBusy } = useOsmCoverageFetch()

  let status: string | null = 'Pan the map to load OSM highways.'
  let tone: 'muted' | 'loading' | 'error' = 'muted'

  if (isFetching || graphBuilding) {
    status = 'Loading OSM…'
    tone = 'loading'
  } else if (graphError) {
    status = `Routing graph failed: ${graphError}`
    tone = 'error'
  } else if (graphReady) {
    status = null
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
    <>
      <section className="border-b border-slate-800 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-white">Network</h2>
            {status ? <p className="mt-2 text-sm leading-tight text-slate-400">{status}</p> : null}
          </div>
          {(tone === 'loading' || graphBuilding) && (
            <span
              aria-hidden
              className="mt-1 size-4 shrink-0 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"
            />
          )}
        </div>

        <fieldset className="mt-4">
          <legend className="sr-only">Network highlight style</legend>
          <div className="space-y-2" role="radiogroup" aria-label="Network highlight style">
            {highlightOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 text-sm text-slate-400"
              >
                <input
                  type="radio"
                  name="network-highlight"
                  className="border-slate-700 bg-slate-900 text-sky-500"
                  checked={network === option.value}
                  onChange={() => updateSearch({ network: option.value })}
                />
                {option.value === 'routing' && option.swatch ? (
                  <span
                    aria-hidden
                    className="inline-flex w-4 shrink-0 items-center justify-between"
                  >
                    <span
                      className="size-1 rounded-full"
                      style={{ backgroundColor: option.swatch }}
                    />
                    <span
                      className="size-1 rounded-full"
                      style={{ backgroundColor: option.swatch }}
                    />
                    <span
                      className="size-1 rounded-full"
                      style={{ backgroundColor: option.swatch }}
                    />
                  </span>
                ) : option.swatch ? (
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
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {option.label}
                  {option.value === 'routing' && graphReady ? (
                    <span className="inline-flex items-center gap-0.5 text-slate-400">
                      <svg aria-hidden viewBox="0 0 16 16" className="size-3 shrink-0" fill="none">
                        <path
                          d="M3.5 8.5 6.5 11.5 12.5 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      ready
                    </span>
                  ) : null}
                </span>
                {option.value === 'overpass' ? (
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatCount(wayCount)} {wayCount === 1 ? 'way' : 'ways'}
                  </span>
                ) : null}
                {option.value === 'routing' ? (
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatCount(edgeCount)} {edgeCount === 1 ? 'edge' : 'edges'}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="border-b border-slate-800 py-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3 shrink-0 text-white transition group-open:rotate-90"
              fill="none"
            >
              <path
                d="M6 4l5 4-5 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className="min-w-0 flex-1 text-sm font-medium text-white">OSM Data</h2>
            {preferFresh ? (
              <span className="shrink-0 text-xs text-slate-400">cache off</span>
            ) : ageLabel ? (
              <span
                className={cn('shrink-0 text-xs', cacheStale ? 'text-amber-400' : 'text-slate-400')}
              >
                from ~{ageLabel}
              </span>
            ) : null}
          </summary>
          <div className="mt-3 space-y-2">
            {preferFresh ? (
              <p className="text-sm leading-tight text-slate-400">
                Cache is off; OSM is fetched fresh.
              </p>
            ) : cacheAgeDistance ? (
              <p className="text-sm leading-tight text-slate-400">
                OSM data is cached locally and {cacheAgeDistance} old.
              </p>
            ) : (
              <p className="text-sm leading-tight text-slate-400">
                OSM data is cached locally after the first load.
              </p>
            )}
            <button
              type="button"
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-left text-sm text-slate-400 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={zoom < viewMinZoom || coverageBusy || !mainMap}
              onClick={() => {
                void reloadViewport({ force: true, clearPersistedOnForce: true })
              }}
            >
              Reload OSM for this view
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
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
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                className="rounded border-slate-700 bg-slate-900 text-sky-500"
                checked={coverageDebug}
                onChange={(event) => updateSearch({ coverageDebug: event.target.checked })}
              />
              Show coverage outline (debug)
            </label>
          </div>
        </details>
      </section>
    </>
  )
}
