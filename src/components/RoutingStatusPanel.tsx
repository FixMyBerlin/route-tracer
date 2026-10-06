import { formatCoverageAgeHour } from '@osm-editor-kit/osm-coverage'
import { formatDistanceStrict } from 'date-fns'
import { useRef, useSyncExternalStore } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { twJoin } from 'tailwind-merge'
import { Route } from '@/routes/index'
import { useMapLoaded, useMapViewEpoch, useOsmStorageReady } from '@/shared/map/map-chrome-store'
import { NETWORK_HIGHLIGHT_COLORS, viewMinZoom } from '@/shared/routing/constants'
import { scheduleCoverageFromMap } from '@/shared/routing/map-helpers'
import { useOsmCoverageFetch, useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import type { NetworkHighlightMode } from '@/shared/routing/search-schema'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { viewportNeedsOsmFetch } from '@/shared/routing/viewport-needs-osm-fetch'

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

function ReloadIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none">
      <path
        d="M3.2 8a4.8 4.8 0 0 1 8.15-3.4M12.8 8a4.8 4.8 0 0 1-8.15 3.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11.2 2.8v2.4H8.8M4.8 13.2V10.8h2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RoutingStatusPanel({ zoom }: RoutingStatusPanelProps) {
  const network = Route.useSearch({ select: (search) => search.network })
  const { updateSearch } = useIndexSearchNavigation()
  const { wayCount, edgeCount, graphReady, graphBuilding, graphError } = useRoutingReadiness()
  const savedAt = useOsmCoverageQuery({ select: (data) => data.savedAt })
  const coverage = useOsmCoverageQuery({ select: (data) => data.coverage })
  const savedAtIso = savedAt.data ?? null
  const nowMs = useMinuteClockMs()
  const ageLabel = formatCoverageAgeHour(savedAtIso, new Date(nowMs))
  const savedAtMs = savedAtIso ? Date.parse(savedAtIso) : Number.NaN
  const cacheStale = Number.isFinite(savedAtMs) && nowMs - savedAtMs > ONE_HOUR_MS
  const cacheAgeDistance = Number.isFinite(savedAtMs)
    ? formatDistanceStrict(savedAtMs, nowMs)
    : null
  const { mainMap } = useMap()
  const mapLoaded = useMapLoaded()
  // Subscribed only to re-render — and so re-read the bounds below — once the camera settles.
  useMapViewEpoch()
  const storageReady = useOsmStorageReady()
  const { loadOsmData, isFetching: coverageBusy, error: loadError } = useOsmCoverageFetch()
  const reloadDialogRef = useRef<HTMLDialogElement>(null)

  const mapLibre = mapLoaded ? (mainMap?.getMap() ?? null) : null
  const fetchArgs = mapLibre ? scheduleCoverageFromMap(mapLibre) : null
  const needsFetch =
    fetchArgs != null &&
    viewportNeedsOsmFetch(fetchArgs.bounds, coverage.data, fetchArgs.zoom, fetchArgs.mapSizePx)

  let status: string | null = 'Load the road network for this view to start tracing.'
  let tone: 'muted' | 'loading' | 'error' = 'muted'

  if (coverageBusy || graphBuilding) {
    status = 'Loading OSM…'
    tone = 'loading'
  } else if (loadError) {
    status = `Loading OSM failed: ${loadError}`
    tone = 'error'
  } else if (graphError) {
    status = `Routing graph failed: ${graphError}`
    tone = 'error'
  } else if (graphReady) {
    status = null
  } else if (wayCount > 0) {
    status = 'Building routing graph…'
    tone = 'loading'
  }

  const zoomTooLow = zoom < viewMinZoom
  const loadDisabled = !mapLibre || !storageReady || coverageBusy || zoomTooLow || !needsFetch
  const reloadDisabled = !mapLibre || !storageReady || coverageBusy || zoomTooLow
  const loadDisabledReason = !mapLibre
    ? 'Map is not ready'
    : !storageReady
      ? 'Restoring cached OSM…'
      : coverageBusy
        ? 'Loading OSM…'
        : zoomTooLow
          ? 'Zoom in to load the road network'
          : !needsFetch
            ? 'Road network for this view is already loaded'
            : undefined

  async function loadViewport(options?: { force?: boolean; clearPersistedOnForce?: boolean }) {
    if (!mapLibre) return
    await loadOsmData(scheduleCoverageFromMap(mapLibre), options)
  }

  function openReloadConfirm() {
    reloadDialogRef.current?.showModal()
  }

  function confirmReload() {
    reloadDialogRef.current?.close()
    void loadViewport({ force: true, clearPersistedOnForce: true })
  }

  return (
    <>
      <section className="border-b border-slate-800 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium text-white">Network</h2>
            {status ? (
              <p
                className={twJoin(
                  'mt-2 text-sm leading-tight',
                  tone === 'error' ? 'text-amber-400' : 'text-slate-400',
                )}
                role={tone === 'error' ? 'alert' : undefined}
              >
                {status}
              </p>
            ) : null}
          </div>
          {tone === 'loading' && (
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
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-medium text-white">OSM Data</h2>
          {ageLabel ? (
            <span
              className={twJoin(
                'shrink-0 text-xs',
                cacheStale ? 'text-amber-400' : 'text-slate-400',
              )}
            >
              from ~{ageLabel}
            </span>
          ) : null}
        </div>

        {cacheAgeDistance ? (
          <p className="mt-2 text-sm leading-tight text-slate-400">
            OSM data is cached locally and {cacheAgeDistance} old.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-tight text-slate-400">
            OSM data is cached locally after the first load.
          </p>
        )}

        <div className="mt-4 flex items-stretch gap-2">
          <span className="min-w-0 flex-1" title={loadDisabled ? loadDisabledReason : undefined}>
            <button
              type="button"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-sm text-slate-200 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loadDisabled}
              onClick={() => {
                void loadViewport()
              }}
            >
              Load road network for current view port
            </button>
          </span>
          <span title="Reload OSM for current view box">
            <button
              type="button"
              aria-label="Reload OSM for current view box"
              className="flex size-[2.625rem] shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={reloadDisabled}
              onClick={openReloadConfirm}
            >
              <ReloadIcon />
            </button>
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-tight text-slate-500">Zoom in to make it smaller</p>

        <dialog
          ref={reloadDialogRef}
          className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-200 shadow-xl backdrop:bg-black/50"
        >
          <p className="text-sm leading-snug text-slate-200">
            Are you sure you want to load fresh data from OSM servers?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
              onClick={() => reloadDialogRef.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
              onClick={confirmReload}
            >
              Reload
            </button>
          </div>
        </dialog>
      </section>
    </>
  )
}
