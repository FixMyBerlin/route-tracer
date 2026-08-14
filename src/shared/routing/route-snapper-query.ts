import { emptyParsedOsmData } from '@osm-editor-kit/osm-data'
import { countRoadWays, createRouteSnapperGraphApi } from '@osm-editor-kit/osm-route-snapper'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { densifyParsedOsmForSnapping } from '@/shared/routing/densify-osm-for-snapping'
import {
  emptyOsmCoverageData,
  osmCoverageSessionKey,
  useOsmCoverageQuery,
} from '@/shared/routing/osm-coverage-query'
import {
  emptyPointCollection,
  snappableNodesFromGraphBytes,
} from '@/shared/routing/routing-network-snap-nodes'

function useCoverageGraph() {
  const graph = useOsmCoverageQuery().data?.graph ?? emptyParsedOsmData()
  return useMemo(() => densifyParsedOsmForSnapping(graph), [graph])
}

const routeSnapperGraphApi = createRouteSnapperGraphApi({
  getGraphKey: () => ['route-tracer', 'route-snapper-graph', 'densify-v3'] as const,
  useCoverageGraph,
})

export const useRouteSnapperGraphQuery = routeSnapperGraphApi.createUseQuery()

/** Nodes the WASM snapper will actually attach to (`debugSnappableNodes`). */
export function useSnappableNodesQuery() {
  const graph = useRouteSnapperGraphQuery()
  const graphBytes = graph.data?.graphBytes ?? null

  return useQuery({
    queryKey: ['route-tracer', 'snappable-nodes', graph.dataUpdatedAt] as const,
    queryFn: async () => {
      if (!graphBytes) return emptyPointCollection
      return snappableNodesFromGraphBytes(graphBytes)
    },
    enabled: graphBytes != null,
    staleTime: Number.POSITIVE_INFINITY,
  })
}

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
