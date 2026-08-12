import { Layer, Source } from 'react-map-gl/maplibre'
import {
  ROUTE_MANUAL_LAYER_ID,
  ROUTE_SNAPPED_LAYER_ID,
  ROUTE_TOOL_SOURCE_ID,
  ROUTE_WAYPOINT_LAYER_ID,
} from '@/shared/routing/route-layer-ids'
import { useRouteToolGeoJson } from '@/shared/routing/route-store'

export function RouteToolLayers() {
  const geojson = useRouteToolGeoJson()

  return (
    <>
      <Source id={ROUTE_TOOL_SOURCE_ID} type="geojson" data={geojson} />
      <Layer
        id={ROUTE_SNAPPED_LAYER_ID}
        type="line"
        source={ROUTE_TOOL_SOURCE_ID}
        filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'snapped'], true]]}
        paint={{
          'line-color': '#38bdf8',
          'line-width': 5,
        }}
      />
      <Layer
        id={ROUTE_MANUAL_LAYER_ID}
        type="line"
        source={ROUTE_TOOL_SOURCE_ID}
        filter={['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'snapped'], false]]}
        paint={{
          'line-color': '#fb923c',
          'line-width': 5,
          'line-dasharray': [2, 1.5],
        }}
      />
      <Layer
        id={ROUTE_WAYPOINT_LAYER_ID}
        type="circle"
        source={ROUTE_TOOL_SOURCE_ID}
        filter={['==', ['geometry-type'], 'Point']}
        paint={{
          'circle-color': '#e2e8f0',
          'circle-radius': 6,
          'circle-stroke-color': '#0f172a',
          'circle-stroke-width': 2,
        }}
      />
    </>
  )
}
