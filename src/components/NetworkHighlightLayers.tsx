import { Layer, Source } from 'react-map-gl/maplibre'
import { Route } from '@/routes/index'
import { NETWORK_HIGHLIGHT_COLORS } from '@/shared/routing/constants'
import { ROUTE_SNAPPED_LAYER_ID } from '@/shared/routing/route-layer-ids'
import {
  useOverpassWaysGeoJson,
  useRouteSnapperGraphQuery,
  useSnappableNodesQuery,
} from '@/shared/routing/route-snapper-query'

const OVERPASS_HIGHLIGHT_SOURCE_ID = 'network-highlight-overpass'
const OVERPASS_HIGHLIGHT_LAYER_ID = 'network-highlight-overpass-line'
const ROUTING_HIGHLIGHT_SOURCE_ID = 'network-highlight-routing'
const ROUTING_HIGHLIGHT_LAYER_ID = 'network-highlight-routing-line'
const ROUTING_HIGHLIGHT_NODES_SOURCE_ID = 'network-highlight-routing-nodes'
const ROUTING_HIGHLIGHT_NODES_LAYER_ID = 'network-highlight-routing-nodes'

/** Thin overlay on top of Positron; drawn route layers sit above this. */
const NETWORK_HIGHLIGHT_LINE_WIDTH = 1.5
/** Hairline + 1px each side; no stroke so the dots stay subtle. */
const ROUTING_SNAP_NODE_RADIUS_PX = NETWORK_HIGHLIGHT_LINE_WIDTH / 2 + 1

const emptyCollection = { type: 'FeatureCollection' as const, features: [] }

/**
 * Overpass: sky hairline on raw OSM ways.
 * Routing graph: purple hairline plus subtle dots at snappable nodes
 * (fixed pixel size, independent of road class).
 *
 * Inserted below the drawn route (`ROUTE_SNAPPED_LAYER_ID`). Positron is untouched.
 */
export function NetworkHighlightLayers() {
  const mode = Route.useSearch({ select: (search) => search.network })
  const graph = useRouteSnapperGraphQuery()
  const snappableNodes = useSnappableNodesQuery()
  const overpassWays = useOverpassWaysGeoJson()

  const overpassData = mode === 'overpass' ? overpassWays : emptyCollection
  const routingData =
    mode === 'routing' ? (graph.data?.routingNetwork ?? emptyCollection) : emptyCollection
  const routingNodes =
    mode === 'routing' ? (snappableNodes.data ?? emptyCollection) : emptyCollection

  return (
    <>
      <Source id={OVERPASS_HIGHLIGHT_SOURCE_ID} type="geojson" data={overpassData}>
        <Layer
          id={OVERPASS_HIGHLIGHT_LAYER_ID}
          type="line"
          beforeId={ROUTE_SNAPPED_LAYER_ID}
          layout={{
            visibility: mode === 'overpass' ? 'visible' : 'none',
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': NETWORK_HIGHLIGHT_COLORS.overpass,
            'line-width': NETWORK_HIGHLIGHT_LINE_WIDTH,
          }}
        />
      </Source>
      <Source id={ROUTING_HIGHLIGHT_SOURCE_ID} type="geojson" data={routingData}>
        <Layer
          id={ROUTING_HIGHLIGHT_LAYER_ID}
          type="line"
          beforeId={ROUTE_SNAPPED_LAYER_ID}
          layout={{
            visibility: mode === 'routing' ? 'visible' : 'none',
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': NETWORK_HIGHLIGHT_COLORS.routing,
            'line-width': NETWORK_HIGHLIGHT_LINE_WIDTH,
          }}
        />
      </Source>
      <Source id={ROUTING_HIGHLIGHT_NODES_SOURCE_ID} type="geojson" data={routingNodes}>
        <Layer
          id={ROUTING_HIGHLIGHT_NODES_LAYER_ID}
          type="circle"
          beforeId={ROUTE_SNAPPED_LAYER_ID}
          layout={{
            visibility: mode === 'routing' ? 'visible' : 'none',
          }}
          paint={{
            'circle-radius': ROUTING_SNAP_NODE_RADIUS_PX,
            'circle-color': NETWORK_HIGHLIGHT_COLORS.routing,
          }}
        />
      </Source>
    </>
  )
}
