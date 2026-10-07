import { useViewportCoverage } from '@/shared/routing/use-viewport-coverage'

type LoadNetworkPromptProps = {
  zoom: number
}

/**
 * Asks to load the road network where the user is looking. Shown while the middle of the map
 * has no roads; once it has, the sidebar offers loading the rest of the view.
 */
export function LoadNetworkPrompt({ zoom }: LoadNetworkPromptProps) {
  const { ready, zoomTooLow, centerLoaded, isFetching, error, loadViewport } =
    useViewportCoverage(zoom)

  // While loading, the indicator in the map corner reports progress and the map stays visible.
  if (!ready || zoomTooLow || centerLoaded || isFetching) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <section
        aria-labelledby="load-network-prompt-title"
        className="pointer-events-auto w-full max-w-xs rounded-xl bg-slate-950/95 p-4 text-center shadow-lg ring-1 ring-slate-700 backdrop-blur-sm"
      >
        <h2 id="load-network-prompt-title" className="text-sm font-medium text-white">
          No roads loaded here yet
        </h2>
        <p className="mt-1 text-sm leading-tight text-slate-400">
          Tracing follows the OpenStreetMap road network, which is loaded area by area.
        </p>
        {error ? (
          <p className="mt-2 text-sm leading-tight text-amber-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-3 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          onClick={() => void loadViewport()}
        >
          {error ? 'Try again' : 'Load roads for this area'}
        </button>
        <p className="mt-3 text-xs leading-tight text-slate-500">
          Every area you load puts work on a community-run server. Please be mindful and load only
          what you need.
        </p>
      </section>
    </div>
  )
}
