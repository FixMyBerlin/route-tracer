import type { Position } from 'geojson'
import init, { JsRouteSnapper } from 'route-snapper'

export type EngineWaypoint = { lon: number; lat: number; snapped: boolean }

type EngineRoute = {
  coordinates: Position[]
  /** The waypoints as routed: snapped ones moved onto their graph node. */
  waypoints: EngineWaypoint[]
}

/**
 * Routing without the map tool: a second route-snapper instance on the same graph, for routing
 * waypoints the user never clicked (auto-snap, export straight from a link).
 */
export type RouteEngine = {
  route: (waypoints: EngineWaypoint[]) => EngineRoute | null
  /** Every graph node a waypoint can snap to. */
  snappableNodes: () => Position[]
}

let cached: { graphBytes: Uint8Array; engine: RouteEngine; free: () => void } | null = null

type CalculatedRoute = {
  geometry?: { type?: string; coordinates?: Position[] }
  properties?: { waypoints?: EngineWaypoint[] }
}

function createEngine(snapper: JsRouteSnapper): RouteEngine {
  let nodes: Position[] | null = null
  return {
    route(waypoints) {
      if (waypoints.length < 2) return null
      try {
        const feature = JSON.parse(
          snapper.calculateRoute(
            waypoints.map((waypoint) => ({
              point: [waypoint.lon, waypoint.lat],
              snapped: waypoint.snapped,
            })),
          ),
        ) as CalculatedRoute
        const coordinates = feature.geometry?.coordinates
        if (feature.geometry?.type !== 'LineString' || !coordinates || coordinates.length < 2) {
          return null
        }
        return { coordinates, waypoints: feature.properties?.waypoints ?? waypoints }
      } catch {
        return null
      }
    },
    snappableNodes() {
      if (nodes) return nodes
      const parsed = JSON.parse(snapper.debugSnappableNodes()) as {
        features: { geometry?: { type?: string; coordinates?: Position } }[]
      }
      nodes = parsed.features.flatMap((feature) =>
        feature.geometry?.type === 'Point' && feature.geometry.coordinates
          ? [feature.geometry.coordinates]
          : [],
      )
      return nodes
    },
  }
}

export async function getRouteEngine(graphBytes: Uint8Array): Promise<RouteEngine> {
  if (cached?.graphBytes === graphBytes) return cached.engine
  await init()
  cached?.free()
  const snapper = new JsRouteSnapper(graphBytes)
  cached = { graphBytes, engine: createEngine(snapper), free: () => snapper.free() }
  return cached.engine
}
