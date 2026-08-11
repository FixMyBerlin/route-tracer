import { serializeMapParam, type MapParam } from '@osm-editor-kit/osm-map-url'
import { OPENFREEMAP_POSITRON_STYLE } from '@osm-editor-kit/osm-maplibre'
import { useNavigate } from '@tanstack/react-router'
import type { MapLibreEvent } from 'maplibre-gl'
import { AttributionControl, Map, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Route } from '@/routes/index'
import { exposeMainMapForDebugging } from '@/shared/map/expose-main-map'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'

type RouteTracerMapProps = {
  mapViewport: MapParam
}

export function RouteTracerMap({ mapViewport }: RouteTracerMapProps) {
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <Map
      id={MAIN_MAP_ID}
      mapStyle={OPENFREEMAP_POSITRON_STYLE}
      initialViewState={{
        longitude: mapViewport.lng,
        latitude: mapViewport.lat,
        zoom: mapViewport.zoom,
        bearing: mapViewport.bearing,
      }}
      style={{ width: '100%', height: '100%' }}
      attributionControl={false}
      onLoad={(event: MapLibreEvent) => {
        exposeMainMapForDebugging(event.target)
      }}
      onMoveEnd={(event: ViewStateChangeEvent) => {
        const { latitude, longitude, zoom, bearing } = event.viewState
        void navigate({
          search: (prev) => ({
            ...prev,
            map: serializeMapParam({ zoom, lat: latitude, lng: longitude, bearing }),
          }),
          replace: true,
        })
      }}
    >
      <AttributionControl compact position="bottom-right" />
    </Map>
  )
}
