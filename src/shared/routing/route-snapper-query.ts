import { emptyParsedOsmData } from '@osm-editor-kit/osm-data'
import { countRoadWays, createRouteSnapperGraphApi } from '@osm-editor-kit/osm-route-snapper'
import { useMemo } from 'react'
import { densifyParsedOsmForSnapping } from '@/shared/routing/densify-osm-for-snapping'
import {
  emptyOsmCoverageData,
  osmCoverageSessionKey,
  useOsmCoverageQuery,
} from '@/shared/routing/osm-coverage-query'

function useCoverageGraph() {
  const graph = useOsmCoverageQuery().data?.graph ?? emptyParsedOsmData()
  return useMemo(() => densifyParsedOsmForSnapping(graph), [graph])
}

const routeSnapperGraphApi = createRouteSnapperGraphApi({
  getGraphKey: () => ['route-tracer', 'route-snapper-graph', 'densify-v2'] as const,
  useCoverageGraph,
})

export const useRouteSnapperGraphQuery = routeSnapperGraphApi.createUseQuery()

export function useRoutingReadiness() {
  const coverage = useOsmCoverageQuery()
  const graph = useRouteSnapperGraphQuery()
  const wayCount = countRoadWays(coverage.data?.graph ?? emptyOsmCoverageData().graph)
  const edgeCount = graph.data?.edgeCount ?? 0

  return {
    wayCount,
    edgeCount,
    graphReady: graph.data?.graphBytes != null,
    graphBuilding: graph.isFetching,
    graphError:
      graph.data?.lastError ?? (graph.error instanceof Error ? graph.error.message : null),
    coverage,
    graph,
  }
}

// Re-export for tests / cache invalidation if needed later.
export { osmCoverageSessionKey }
