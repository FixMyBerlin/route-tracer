import { useRouteWaypoints } from '@/shared/routing/route-store'
import { useLoadRoadsAlongLine } from '@/shared/routing/use-load-roads-along-line'

/**
 * The route between two waypoints can bend away from the straight line between them, so the
 * roads are loaded wider around it than around a GPS track.
 */
const SAVED_ROUTE_BUFFER_METERS = 150

/** Offers loading the roads under a route opened from a link, so it can be routed again. */
export function SavedRouteRoadsPrompt() {
  const waypoints = useRouteWaypoints()
  const line = waypoints.map((waypoint) => [waypoint.lon, waypoint.lat])
  const roads = useLoadRoadsAlongLine(line, { bufferMeters: SAVED_ROUTE_BUFFER_METERS })

  if (roads.missingCount === 0 && !roads.loading) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <section
        aria-labelledby="saved-route-roads-title"
        className="pointer-events-auto w-full max-w-xs rounded-xl bg-slate-950/95 p-4 text-center shadow-lg ring-1 ring-slate-700 backdrop-blur-sm"
      >
        <h2 id="saved-route-roads-title" className="text-sm font-medium text-white">
          Load the roads under this route
        </h2>
        <p className="mt-1 text-sm leading-tight text-slate-400">
          The link holds the route’s points. To draw it on the roads again,{' '}
          {roads.missingCount === 1
            ? 'one area along it needs loading.'
            : `${roads.missingCount} areas along it need loading.`}
        </p>
        {roads.error ? (
          <p className="mt-2 text-sm leading-tight text-amber-400" role="alert">
            {roads.error}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-3 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
          disabled={roads.loading}
          onClick={() => void roads.load()}
        >
          {roads.progress
            ? `Loading ${roads.progress.done + 1} of ${roads.progress.total}…`
            : roads.error
              ? 'Try again'
              : 'Load roads along the route'}
        </button>
        <p className="mt-3 text-xs leading-tight text-slate-500">
          Every area you load puts work on a community-run server. Please be mindful and load only
          what you need.
        </p>
      </section>
    </div>
  )
}
