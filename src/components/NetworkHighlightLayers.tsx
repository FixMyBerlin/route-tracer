import { Layer, Source } from 'react-map-gl/maplibre'
import { Route } from '@/routes/index'
import { NETWORK_HIGHLIGHT_COLORS } from '@/shared/routing/constants'
import { ROUTE_SNAPPED_LAYER_ID } from '@/shared/routing/route-layer-ids'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'
import { routingNetworkSnapNodes } from '@/shared/routing/routing-network-snap-nodes'

const OVERPASS_HIGHLIGHT_SOURCE_ID = 'network-highlight-overpass'
const OVERPASS_HIGHLIGHT_LAYER_ID = 'network-highlight-overpass-line'
const ROUTING_HIGHLIGHT_SOURCE_ID = 'network-highlight-routing'
const ROUTING_HIGHLIGHT_LAYER_ID = 'network-highlight-routing-line'
const ROUTING_HIGHLIGHT_NODES_SOURCE_ID = 'network-highlight-routing-nodes'
const ROUTING_HIGHLIGHT_NODES_LAYER_ID = 'network-highlight-routing-nodes'

/** Thin overlay on top of Positron; drawn route layers sit above this. */
const NETWORK_HIGHLIGHT_LINE_WIDTH = 1.5
const ROUTING_SNAP_NODE_RADIUS_PX = 2.5

const emptyCollection = { type: 'FeatureCollection' as const, features: [] }

/**
 * Overpass: sky hairline on raw OSM ways.
 * Routing graph: purple hairline plus small snap-node dots on top of the way
 * (fixed pixel size, independent of road class).
 *
 * Inserted below the drawn route (`ROUTE_SNAPPED_LAYER_ID`). Positron is untouched.
 */
export function NetworkHighlightLayers() {
  const mode = Route.useSearch({ select: (search) => search.network })
  const graph = useRouteSnapperGraphQuery()

  const overpassData =
    mode === 'overpass' ? (graph.data?.overpassWays ?? emptyCollection) : emptyCollection
  const routingData =
    mode === 'routing' ? (graph.data?.routingNetwork ?? emptyCollection) : emptyCollection
  const routingNodes =
    mode === 'routing' && graph.data?.routingNetwork
      ? routingNetworkSnapNodes(graph.data.routingNetwork)
      : emptyCollection

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
            'circle-stroke-color': '#f8fafc',
            'circle-stroke-width': 0.75,
            'circle-opacity': 0.95,
          }}
        />
      </Source>
    </>
  )
}
