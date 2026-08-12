import { Layer, Source } from 'react-map-gl/maplibre'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'
import { NETWORK_HIGHLIGHT_COLORS, useNetworkHighlight } from '@/shared/routing/routing-ui-store'

/** First OpenFreeMap Positron road casing — highlights draw underneath the street network. */
const STREET_NETWORK_BEFORE_ID = 'tunnel_motorway_casing'

const OVERPASS_HIGHLIGHT_SOURCE_ID = 'network-highlight-overpass'
const OVERPASS_HIGHLIGHT_LAYER_ID = 'network-highlight-overpass-line'
const ROUTING_HIGHLIGHT_SOURCE_ID = 'network-highlight-routing'
const ROUTING_HIGHLIGHT_LAYER_ID = 'network-highlight-routing-line'

/**
 * Casing under basemap roads: ~highway_minor width + 2px each side.
 * @see openfreemap-positron highway_minor line-width
 */
const HIGHLIGHT_LINE_WIDTH = ['interpolate', ['exponential', 1.55], ['zoom'], 13, 5.8, 20, 24] as [
  'interpolate',
  ['exponential', number],
  ['zoom'],
  number,
  number,
  number,
  number,
]

const emptyCollection = { type: 'FeatureCollection' as const, features: [] }

/**
 * Wider line casings below the street network for Overpass cache / routing graph debug.
 */
export function NetworkHighlightLayers() {
  const mode = useNetworkHighlight()
  const graph = useRouteSnapperGraphQuery()

  const overpassData =
    mode === 'overpass' ? (graph.data?.overpassWays ?? emptyCollection) : emptyCollection
  const routingData =
    mode === 'routing' ? (graph.data?.routingNetwork ?? emptyCollection) : emptyCollection

  return (
    <>
      <Source id={OVERPASS_HIGHLIGHT_SOURCE_ID} type="geojson" data={overpassData}>
        <Layer
          id={OVERPASS_HIGHLIGHT_LAYER_ID}
          type="line"
          beforeId={STREET_NETWORK_BEFORE_ID}
          layout={{
            visibility: mode === 'overpass' ? 'visible' : 'none',
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': NETWORK_HIGHLIGHT_COLORS.overpass,
            'line-width': HIGHLIGHT_LINE_WIDTH,
            'line-opacity': 0.85,
          }}
        />
      </Source>
      <Source id={ROUTING_HIGHLIGHT_SOURCE_ID} type="geojson" data={routingData}>
        <Layer
          id={ROUTING_HIGHLIGHT_LAYER_ID}
          type="line"
          beforeId={STREET_NETWORK_BEFORE_ID}
          layout={{
            visibility: mode === 'routing' ? 'visible' : 'none',
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': NETWORK_HIGHLIGHT_COLORS.routing,
            'line-width': HIGHLIGHT_LINE_WIDTH,
            'line-opacity': 0.85,
          }}
        />
      </Source>
    </>
  )
}
