import { useQuery } from '@tanstack/react-query'
import {
  emptyOsmCoverageData,
  osmCoverageSessionKey,
  useOsmCoverageQuery,
} from '@/shared/routing/osm-coverage-query'
import { countRoadWays } from '@/shared/routing/route-snapper-graph'
import { buildRouteSnapperGraphBytes } from '@/shared/routing/route-snapper-graph'

export const routeSnapperGraphKey = ['route-tracer', 'route-snapper-graph'] as const

export type RouteSnapperGraphData = {
  graphBytes: Uint8Array | null
  wayCount: number
  lastError: string | null
}

function emptyRouteSnapperGraphData(): RouteSnapperGraphData {
  return {
    graphBytes: null,
    wayCount: 0,
    lastError: null,
  }
}

function coverageGraphSignature(coverage = emptyOsmCoverageData()) {
  return [
    Object.keys(coverage.graph.ways).length,
    Object.keys(coverage.graph.nodes).length,
    Object.keys(coverage.graph.nodeCoords).length,
  ].join(':')
}

export function useRouteSnapperGraphQuery() {
  const coverage = useOsmCoverageQuery()
  const signature = coverageGraphSignature(coverage.data)

  return useQuery({
    queryKey: [...routeSnapperGraphKey, signature],
    queryFn: async (): Promise<RouteSnapperGraphData> => {
      const wayCount = countRoadWays(coverage.data.graph)
      if (wayCount === 0) return emptyRouteSnapperGraphData()

      try {
        const graphBytes = await buildRouteSnapperGraphBytes(coverage.data.graph)
        return {
          graphBytes,
          wayCount,
          lastError: null,
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Graph build failed'
        console.error('route-snapper graph build failed', error)
        return {
          graphBytes: null,
          wayCount,
          lastError: message,
        }
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
    enabled: countRoadWays(coverage.data.graph) > 0,
  })
}

export function useRoutingReadiness() {
  const coverage = useOsmCoverageQuery()
  const graph = useRouteSnapperGraphQuery()
  const wayCount = countRoadWays(coverage.data.graph)

  return {
    wayCount,
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
