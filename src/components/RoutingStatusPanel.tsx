import { formatDistanceStrict } from 'date-fns'
import { useRef, useSyncExternalStore } from 'react'
import { twJoin } from 'tailwind-merge'
import { Route } from '@/routes/index'
import { NETWORK_HIGHLIGHT_COLORS, viewMinZoom } from '@/shared/routing/constants'
import { useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { useRoutingReadiness } from '@/shared/routing/route-snapper-query'
import type { NetworkHighlightMode } from '@/shared/routing/search-schema'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { useViewportCoverage } from '@/shared/routing/use-viewport-coverage'

type RoutingStatusPanelProps = {
  zoom: number
}

function formatCount(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

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
  const savedAtIso = savedAt.data ?? null
  const nowMs = useMinuteClockMs()
  const savedAtMs = savedAtIso ? Date.parse(savedAtIso) : Number.NaN
  const cacheAgeDistance = Number.isFinite(savedAtMs)
    ? formatDistanceStrict(savedAtMs, nowMs)
    : null
  const {
    ready,
    zoomTooLow,
    needsFetch,
    centerLoaded,
    isFetching: coverageBusy,
    error: loadError,
    loadViewport,
  } = useViewportCoverage(zoom)
  const reloadDialogRef = useRef<HTMLDialogElement>(null)

  let status: string | null = 'Load roads for this view to start tracing.'
  let tone: 'muted' | 'loading' | 'error' = 'muted'

  if (coverageBusy || graphBuilding) {
    status = 'Loading roads…'
    tone = 'loading'
  } else if (loadError) {
    status = loadError
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

  const canLoad = ready && !zoomTooLow && !coverageBusy
  const viewLoaded = ready && !zoomTooLow && !needsFetch

  let dataStatus = 'Roads for this view are loaded.'
  if (coverageBusy) dataStatus = 'Loading roads…'
  else if (!ready) dataStatus = 'Looking for roads saved in this browser…'
  else if (zoomTooLow) dataStatus = `Zoom in to level ${viewMinZoom} or closer to load roads.`
  else if (!centerLoaded) dataStatus = 'No roads loaded for this view yet.'
  else if (needsFetch) dataStatus = 'Roads are loaded for part of this view.'

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
        <h2 className="text-sm font-medium text-white">Road data</h2>

        <p className="mt-2 text-sm leading-tight text-slate-400">
          {dataStatus}
          {cacheAgeDistance
            ? ` Loaded roads are saved in this browser, last updated ${cacheAgeDistance} ago.`
            : ' Loaded roads are saved in this browser.'}
        </p>

        {viewLoaded ? (
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
            disabled={!canLoad}
            onClick={openReloadConfirm}
          >
            <ReloadIcon />
            Reload roads for this view
          </button>
        ) : (
          <>
            <button
              type="button"
              className="mt-3 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
              disabled={!canLoad}
              onClick={() => void loadViewport()}
            >
              {centerLoaded ? 'Load the rest of this view' : 'Load roads for this view'}
            </button>
            <p className="mt-2 text-xs leading-tight text-slate-500">
              Every area you load puts work on a community-run server. Please load only what you
              need.
            </p>
          </>
        )}

        <dialog
          ref={reloadDialogRef}
          className="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-slate-900 p-4 text-slate-200 shadow-xl backdrop:bg-black/50"
        >
          <p className="text-sm leading-snug text-slate-200">
            Download the roads for this view again? Do this only when the roads changed in
            OpenStreetMap — it puts work on a community-run server.
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
