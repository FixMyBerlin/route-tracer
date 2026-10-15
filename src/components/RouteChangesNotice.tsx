import { ReviewItemList } from '@/components/ReviewItemList'
import { routeSearchStateFrom } from '@/shared/routing/route-search-state'
import { getRouteState, useRouteActions } from '@/shared/routing/route-store'
import { useRouteChangeItems } from '@/shared/routing/use-route-change-items'
import { usePersistRoute } from '@/shared/routing/use-route-url-sync'

/**
 * A saved link routed again on today's OpenStreetMap data can come out different. Say where,
 * and only write the new version to the link once the user agrees.
 */
export function RouteChangesNotice() {
  const items = useRouteChangeItems()
  const { setRouteChanges } = useRouteActions()
  const persistRoute = usePersistRoute()

  if (items.length === 0) return null

  const keepNewRoute = () => {
    const { waypoints, segments } = getRouteState()
    setRouteChanges([])
    persistRoute(routeSearchStateFrom(waypoints, segments))
  }

  return (
    <section className="border-b border-slate-800 py-5" role="status">
      <h2 className="text-sm font-medium text-amber-400">
        {items.length === 1
          ? 'One stretch changed since this link was saved'
          : `${items.length} stretches changed since this link was saved`}
      </h2>
      <p className="mt-2 text-sm leading-tight text-slate-400">
        The roads in OpenStreetMap changed, so the same points now route differently. Check the
        highlighted stretches; drag points to fix them, or keep the new route.
      </p>
      <ReviewItemList items={items} />
      <button
        type="button"
        className="mt-3 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        onClick={keepNewRoute}
      >
        Keep the new route
      </button>
    </section>
  )
}
