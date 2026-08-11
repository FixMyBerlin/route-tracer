import { serializeMapParam, type MapParam } from '@osm-editor-kit/osm-map-url'
import { OPENFREEMAP_POSITRON_STYLE } from '@osm-editor-kit/osm-maplibre'
import { useNavigate } from '@tanstack/react-router'
import type { MapLibreEvent } from 'maplibre-gl'
import { useEffect } from 'react'
import { AttributionControl, Map, useMap, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CoverageDebugOverlay } from '@/components/CoverageDebugOverlay'
import { MapLoadingIndicator } from '@/components/MapLoadingIndicator'
import { ReferenceImageOverlay } from '@/components/ReferenceImageOverlay'
import { RouteSnapperHost } from '@/components/RouteSnapperHost'
import { ViewMinZoomOverlay } from '@/components/ViewMinZoomOverlay'
import { Route } from '@/routes/index'
import { exposeMainMapForDebugging } from '@/shared/map/expose-main-map'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { viewMinZoom } from '@/shared/routing/constants'
import { serializeIndexSearch } from '@/shared/routing/search-schema'
import { useRouteCoveragePace } from '@/shared/routing/use-route-coverage-pace'

type RouteTracerMapProps = {
  mapViewport: MapParam
  zoom: number
  onZoomChange: (zoom: number) => void
}

export function RouteTracerMap({ mapViewport, zoom, onZoomChange }: RouteTracerMapProps) {
  const navigate = useNavigate({ from: Route.fullPath })
  const { scheduleCoverageCheck } = useRouteCoveragePace()
  const maps = useMap()
  const mapRef = maps[MAIN_MAP_ID]
  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map) return

    exposeMainMapForDebugging(map)
    onZoomChange(map.getZoom())

    if (map.getZoom() < viewMinZoom) return

    // Always schedule a coverage check when the map instance appears — idempotent
    // if coverage already exists; recovers after Overpass 429 / HMR.
    scheduleCoverageCheck(map)
  }, [mapRef, scheduleCoverageCheck, onZoomChange])

  return (
    <>
      <Map
        id={MAIN_MAP_ID}
        mapStyle={OPENFREEMAP_POSITRON_STYLE}
        initialViewState={{
          longitude: mapViewport.lng,
          latitude: mapViewport.lat,
          zoom: mapViewport.zoom,
          bearing: mapViewport.bearing,
        }}
        boxZoom={false}
        doubleClickZoom={false}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        onLoad={(event: MapLibreEvent) => {
          const map = event.target
          exposeMainMapForDebugging(map)
          onZoomChange(map.getZoom())
          if (map.getZoom() >= viewMinZoom) {
            scheduleCoverageCheck(map)
          }
        }}
        onMove={(event: ViewStateChangeEvent) => {
          onZoomChange(event.viewState.zoom)
          scheduleCoverageCheck(event.target)
        }}
        onMoveEnd={(event: ViewStateChangeEvent) => {
          const { latitude, longitude, zoom: nextZoom, bearing } = event.viewState
          onZoomChange(nextZoom)
          scheduleCoverageCheck(event.target)
          void navigate({
            search: (prev) => ({
              ...serializeIndexSearch(prev),
              map: serializeMapParam({ zoom: nextZoom, lat: latitude, lng: longitude, bearing }),
            }),
            replace: true,
          })
        }}
      >
        <AttributionControl compact position="bottom-right" />
        <ReferenceImageOverlay />
        <CoverageDebugOverlay />
        <RouteSnapperHost />
      </Map>
      <MapLoadingIndicator />
      <ViewMinZoomOverlay zoom={zoom} />
    </>
  )
}
