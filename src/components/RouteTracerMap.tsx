import { type MapParam } from '@osm-editor-kit/osm-map-url'
import { OPENFREEMAP_POSITRON_STYLE } from '@osm-editor-kit/osm-maplibre'
import type { MapLayerMouseEvent, MapLibreEvent } from 'maplibre-gl'
import { useEffect } from 'react'
import { AttributionControl, Map, useMap, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CoverageDebugOverlay } from '@/components/CoverageDebugOverlay'
import { MapGeocodingControl } from '@/components/MapGeocodingControl'
import { MapLoadingIndicator } from '@/components/MapLoadingIndicator'
import { NetworkHighlightLayers } from '@/components/NetworkHighlightLayers'
import { useReferenceImageOverlay } from '@/components/ReferenceImageOverlay'
import { RouteSnapperHost } from '@/components/RouteSnapperHost'
import { RouteToolLayers } from '@/components/RouteToolLayers'
import { ViewMinZoomOverlay } from '@/components/ViewMinZoomOverlay'
import {
  exposeCoverageLoaderForDebugging,
  exposeMainMapForDebugging,
} from '@/shared/map/expose-main-map'
import { useMapChromeActions } from '@/shared/map/map-chrome-store'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { viewMinZoom } from '@/shared/routing/constants'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { useRouteCoveragePace } from '@/shared/routing/use-route-coverage-pace'
import type { WorkflowStep } from '@/shared/routing/workflow-steps'

type RouteTracerMapProps = {
  mapViewport: MapParam
  zoom: number
  step: WorkflowStep
  onZoomChange: (zoom: number) => void
}

export function RouteTracerMap({ mapViewport, zoom, step, onZoomChange }: RouteTracerMapProps) {
  const { updateSearch } = useIndexSearchNavigation()
  const tracing = step === 'tracing'
  const imageEditable = step === 'image'
  const { scheduleCoverageCheck, loadCoverageNow } = useRouteCoveragePace({ enabled: tracing })
  const { markMapLoaded } = useMapChromeActions()
  const { mapHandlers: referenceImageHandlers, layers: referenceImageLayers } =
    useReferenceImageOverlay({ editable: imageEditable })

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
        interactiveLayerIds={referenceImageHandlers.interactiveLayerIds}
        onLoad={(event: MapLibreEvent) => {
          const map = event.target
          markMapLoaded()
          exposeMainMapForDebugging(map)
          exposeCoverageLoaderForDebugging((m) => {
            void loadCoverageNow(m)
          })
          onZoomChange(map.getZoom())
          if (tracing && map.getZoom() >= viewMinZoom) {
            scheduleCoverageCheck(map)
          }
        }}
        onMouseDown={(event: MapLayerMouseEvent) => {
          referenceImageHandlers.onMouseDown(event)
        }}
        onMouseMove={(event: MapLayerMouseEvent) => {
          referenceImageHandlers.onMouseMove(event)
        }}
        onMouseUp={(event: MapLayerMouseEvent) => {
          referenceImageHandlers.onMouseUp(event)
        }}
        onMouseLeave={(event: MapLayerMouseEvent) => {
          referenceImageHandlers.onMouseLeave(event)
        }}
        onMove={(event: ViewStateChangeEvent) => {
          onZoomChange(event.viewState.zoom)
          if (tracing) scheduleCoverageCheck(event.target)
        }}
        onMoveEnd={(event: ViewStateChangeEvent) => {
          const { latitude, longitude, zoom: nextZoom, bearing } = event.viewState
          onZoomChange(nextZoom)
          if (tracing) scheduleCoverageCheck(event.target)
          updateSearch({
            map: { zoom: nextZoom, lat: latitude, lng: longitude, bearing },
          })
        }}
      >
        <AttributionControl compact position="bottom-right" />
        <MapGeocodingControl />
        {tracing ? <NetworkHighlightLayers /> : null}
        {referenceImageLayers}
        <RouteToolLayers />
        {tracing ? <CoverageDebugOverlay /> : null}
        {tracing ? <RouteSnapperHost /> : null}
        {tracing ? <TracingCoverageKick onReady={scheduleCoverageCheck} /> : null}
      </Map>
      <MapLoadingIndicator />
      {tracing ? <ViewMinZoomOverlay zoom={zoom} /> : null}
    </>
  )
}

type TracingCoverageKickProps = {
  onReady: (map: import('maplibre-gl').Map) => void
}

/** Schedules Overpass coverage once when entering the tracing step (map may already be loaded). */
function TracingCoverageKick({ onReady }: TracingCoverageKickProps) {
  const maps = useMap()
  const mapRef = maps[MAIN_MAP_ID]

  useEffect(
    function kickCoverageOnTraceEnter() {
      const map = mapRef?.getMap()
      if (!map) return
      onReady(map)
    },
    [mapRef, onReady],
  )

  return null
}
