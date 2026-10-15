import { type MapParam } from '@osm-editor-kit/osm-map-url'
import { OPENFREEMAP_POSITRON_STYLE } from '@osm-editor-kit/osm-maplibre'
import type { MapLayerMouseEvent, MapLibreEvent } from 'maplibre-gl'
import { AttributionControl, Map, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CoverageMaskLayers } from '@/components/CoverageMaskLayers'
import { LoadNetworkPrompt } from '@/components/LoadNetworkPrompt'
import { MapGeocodingControl } from '@/components/MapGeocodingControl'
import { MapLoadingIndicator } from '@/components/MapLoadingIndicator'
import { NetworkHighlightLayers } from '@/components/NetworkHighlightLayers'
import { useReferenceImageOverlay } from '@/components/ReferenceImageOverlay'
import { ReviewHighlightLayers } from '@/components/ReviewHighlightLayers'
import { RouteSnapperHost } from '@/components/RouteSnapperHost'
import { RouteToolLayers } from '@/components/RouteToolLayers'
import { SavedRouteRoadsPrompt } from '@/components/SavedRouteRoadsPrompt'
import { ViewMinZoomOverlay } from '@/components/ViewMinZoomOverlay'
import { exposeMainMapForDebugging } from '@/shared/map/expose-main-map'
import { useMapChromeActions } from '@/shared/map/map-chrome-store'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { useRestoreOsmCoverage } from '@/shared/routing/use-restore-osm-coverage'
import { useRouteChangeItems } from '@/shared/routing/use-route-change-items'
import { useSavedRouteNeedsRoads } from '@/shared/routing/use-saved-route-needs-roads'
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
  const savedRouteNeedsRoads = useSavedRouteNeedsRoads()
  const routeChangeItems = useRouteChangeItems()
  useRestoreOsmCoverage()
  const { markMapLoaded, bumpViewEpoch } = useMapChromeActions()
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
        cursor={referenceImageHandlers.cursor}
        interactiveLayerIds={referenceImageHandlers.interactiveLayerIds}
        onLoad={(event: MapLibreEvent) => {
          const map = event.target
          markMapLoaded()
          bumpViewEpoch()
          exposeMainMapForDebugging(map)
          onZoomChange(map.getZoom())
        }}
        onMouseDown={(event: MapLayerMouseEvent) => referenceImageHandlers.onMouseDown(event)}
        onMouseMove={(event: MapLayerMouseEvent) => referenceImageHandlers.onMouseMove(event)}
        onMouseUp={() => referenceImageHandlers.onMouseUp()}
        onMouseLeave={() => referenceImageHandlers.onMouseLeave()}
        onMove={(event: ViewStateChangeEvent) => {
          onZoomChange(event.viewState.zoom)
        }}
        onMoveEnd={(event: ViewStateChangeEvent) => {
          const { latitude, longitude, zoom: nextZoom, bearing } = event.viewState
          onZoomChange(nextZoom)
          bumpViewEpoch()
          updateSearch({
            map: { zoom: nextZoom, lat: latitude, lng: longitude, bearing },
          })
        }}
      >
        <AttributionControl compact position="bottom-right" />
        <MapGeocodingControl />
        <RouteToolLayers />
        {tracing ? <ReviewHighlightLayers items={routeChangeItems} /> : null}
        {tracing ? <CoverageMaskLayers /> : null}
        {tracing ? <NetworkHighlightLayers /> : null}
        {referenceImageLayers}
        {tracing ? <RouteSnapperHost /> : null}
      </Map>
      <MapLoadingIndicator />
      {tracing ? <ViewMinZoomOverlay zoom={zoom} /> : null}
      {tracing && savedRouteNeedsRoads ? <SavedRouteRoadsPrompt /> : null}
      {tracing && !savedRouteNeedsRoads ? <LoadNetworkPrompt zoom={zoom} /> : null}
    </>
  )
}
