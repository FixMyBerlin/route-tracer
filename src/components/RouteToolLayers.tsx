import { Layer, Source } from 'react-map-gl/maplibre'
import {
  ROUTE_LINE_WIDTH_PX,
  ROUTE_NODE_RADIUS_PX,
  ROUTE_SEGMENT_COLORS,
  ROUTE_SNAPPED_LINE_OFFSET_PX,
  ROUTE_WAYPOINT_COLORS,
  ROUTE_WAYPOINT_RADIUS_PX,
} from '@/shared/routing/constants'
import {
  ROUTE_MANUAL_LAYER_ID,
  ROUTE_NODE_LAYER_ID,
  ROUTE_SNAPPED_LAYER_ID,
  ROUTE_TOOL_SOURCE_ID,
  ROUTE_WAYPOINT_LABEL_LAYER_ID,
  ROUTE_WAYPOINT_LAYER_ID,
} from '@/shared/routing/route-layer-ids'
import { useRouteToolGeoJson } from '@/shared/routing/route-store'

/**
 * Declarative paint for route-snapper `renderGeojson()` output:
 * LineStrings (`snapped`) plus Points (`snapped-waypoint` / `free-waypoint` / `node`).
 *
 * Filters use expression syntax only (no legacy `$type`) so they can combine with `get`.
 */
export function RouteToolLayers() {
  const geojson = useRouteToolGeoJson()

  return (
    <Source id={ROUTE_TOOL_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={ROUTE_SNAPPED_LAYER_ID}
        type="line"
        filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'snapped'], true]]}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': ROUTE_SEGMENT_COLORS.snapped,
          'line-width': ROUTE_LINE_WIDTH_PX,
          'line-offset': ROUTE_SNAPPED_LINE_OFFSET_PX,
        }}
      />
      <Layer
        id={ROUTE_MANUAL_LAYER_ID}
        type="line"
        filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'snapped'], false]]}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': ROUTE_SEGMENT_COLORS.freehand,
          'line-width': ROUTE_LINE_WIDTH_PX,
          'line-dasharray': [0.5, 1.5],
        }}
      />
      <Layer
        id={ROUTE_NODE_LAYER_ID}
        type="circle"
        filter={['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'type'], 'node']]}
        paint={{
          'circle-radius': [
            'case',
            ['has', 'hovered'],
            ROUTE_NODE_RADIUS_PX + 2,
            ROUTE_NODE_RADIUS_PX,
          ],
          'circle-color': '#0f172a',
          'circle-stroke-color': '#f8fafc',
          'circle-stroke-width': 1.5,
          'circle-opacity': ['case', ['has', 'hovered'], 0.55, 1],
        }}
      />
      <Layer
        id={ROUTE_WAYPOINT_LAYER_ID}
        type="circle"
        filter={[
          'all',
          ['==', ['geometry-type'], 'Point'],
          [
            'any',
            ['==', ['get', 'type'], 'snapped-waypoint'],
            ['==', ['get', 'type'], 'free-waypoint'],
            ['==', ['get', 'type'], 'snap-preview'],
          ],
        ]}
        paint={{
          'circle-radius': [
            'case',
            ['has', 'hovered'],
            ROUTE_WAYPOINT_RADIUS_PX + 2,
            ROUTE_WAYPOINT_RADIUS_PX,
          ],
          'circle-color': [
            'match',
            ['get', 'kind'],
            'edge',
            ROUTE_WAYPOINT_COLORS.edge,
            ROUTE_WAYPOINT_COLORS.mid,
          ],
          'circle-stroke-color': '#f8fafc',
          'circle-stroke-width': 2,
          'circle-opacity': ['case', ['has', 'hovered'], 0.55, 1],
        }}
      />
      <Layer
        id={ROUTE_WAYPOINT_LABEL_LAYER_ID}
        type="symbol"
        filter={['all', ['==', ['geometry-type'], 'Point'], ['has', 'click_index']]}
        layout={{
          'text-field': ['to-string', ['get', 'click_index']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['case', ['>', ['get', 'click_index'], 9], 9, 11],
          'text-anchor': 'center',
          'text-justify': 'center',
          'text-offset': [0, 0],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-padding': 0,
        }}
        paint={{
          'text-color': '#ffffff',
          'text-opacity': ['case', ['has', 'hovered'], 0.55, 1],
        }}
      />
    </Source>
  )
}
