import { Layer, Source } from 'react-map-gl/maplibre'
import { ROUTE_SEGMENT_COLORS } from '@/shared/routing/constants'
import {
  ROUTE_MANUAL_LAYER_ID,
  ROUTE_NODE_LAYER_ID,
  ROUTE_SNAPPED_LAYER_ID,
  ROUTE_TOOL_SOURCE_ID,
  ROUTE_WAYPOINT_LAYER_ID,
} from '@/shared/routing/route-layer-ids'
import { useRouteToolGeoJson } from '@/shared/routing/route-store'

/** Matches route-snapper demo sizing: waypoints larger than intermediate nodes. */
const WAYPOINT_RADIUS_PX = 8
const NODE_RADIUS_PX = 5

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
          'line-width': 5,
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
          'line-width': 5,
          'line-dasharray': [2, 1.5],
        }}
      />
      <Layer
        id={ROUTE_NODE_LAYER_ID}
        type="circle"
        filter={['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'type'], 'node']]}
        paint={{
          'circle-radius': ['case', ['has', 'hovered'], NODE_RADIUS_PX + 2, NODE_RADIUS_PX],
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
          ],
        ]}
        paint={{
          'circle-radius': ['case', ['has', 'hovered'], WAYPOINT_RADIUS_PX + 2, WAYPOINT_RADIUS_PX],
          'circle-color': [
            'match',
            ['get', 'type'],
            'free-waypoint',
            ROUTE_SEGMENT_COLORS.freehand,
            '#dc2626',
          ],
          'circle-stroke-color': '#f8fafc',
          'circle-stroke-width': 2,
          'circle-opacity': ['case', ['has', 'hovered'], 0.55, 1],
        }}
      />
    </Source>
  )
}
