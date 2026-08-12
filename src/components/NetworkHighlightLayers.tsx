import { Layer, Source } from 'react-map-gl/maplibre'
import { Route } from '@/routes/index'
import { NETWORK_HIGHLIGHT_COLORS } from '@/shared/routing/constants'
import { useRouteSnapperGraphQuery } from '@/shared/routing/route-snapper-query'

/** First OpenFreeMap Positron road casing — Overpass highlight draws underneath streets. */
const STREET_NETWORK_BEFORE_ID = 'tunnel_motorway_casing'

const OVERPASS_HIGHLIGHT_SOURCE_ID = 'network-highlight-overpass'
const OVERPASS_HIGHLIGHT_LAYER_ID = 'network-highlight-overpass-line'
const ROUTING_HIGHLIGHT_SOURCE_ID = 'network-highlight-routing'
const ROUTING_HIGHLIGHT_CASING_LAYER_ID = 'network-highlight-routing-casing'
const ROUTING_HIGHLIGHT_LAYER_ID = 'network-highlight-routing-line'

/**
 * Casing under basemap roads: ~highway_minor width + 2px each side.
 * @see openfreemap-positron highway_minor line-width
 */
const OVERPASS_LINE_WIDTH = ['interpolate', ['exponential', 1.55], ['zoom'], 13, 5.8, 20, 24] as [
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
 * Overpass: thick casing under basemap roads.
 * Routing graph: black dotted lines on top so snap targets stay visible while drawing.
 */
export function NetworkHighlightLayers() {
  const mode = Route.useSearch({ select: (search) => search.network })
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
            'line-width': OVERPASS_LINE_WIDTH,
            'line-opacity': 0.85,
          }}
        />
      </Source>
      <Source id={ROUTING_HIGHLIGHT_SOURCE_ID} type="geojson" data={routingData}>
        {/* Light casing so black dashes stay readable on Positron streets. */}
        <Layer
          id={ROUTING_HIGHLIGHT_CASING_LAYER_ID}
          type="line"
          layout={{
            visibility: mode === 'routing' ? 'visible' : 'none',
            'line-cap': 'butt',
            'line-join': 'round',
          }}
          paint={{
            'line-color': '#f8fafc',
            'line-width': 4,
            'line-opacity': 0.85,
          }}
        />
        <Layer
          id={ROUTING_HIGHLIGHT_LAYER_ID}
          type="line"
          layout={{
            visibility: mode === 'routing' ? 'visible' : 'none',
            'line-cap': 'butt',
            'line-join': 'round',
          }}
          paint={{
            'line-color': NETWORK_HIGHLIGHT_COLORS.routing,
            'line-width': 2.5,
            'line-opacity': 1,
            'line-dasharray': [1.25, 1],
          }}
        />
      </Source>
    </>
  )
}
