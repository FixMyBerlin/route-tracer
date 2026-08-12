import { MAP_CUSTOM_CONTENT_ANCHOR_LAYER_ID } from '@osm-editor-kit/osm-maplibre'
import { useDebouncedCallback } from '@tanstack/react-pacer'
import type { Map as MaplibreMap, MapLayerMouseEvent } from 'maplibre-gl'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'
import { Route } from '@/routes/index'
import { useMapLoaded } from '@/shared/map/map-chrome-store'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { computeInitialImageCoords } from '@/shared/reference-image/initial-coordinates'
import { cornersToGeoJson } from '@/shared/reference-image/overlay-geojson'
import {
  REFERENCE_IMAGE_HANDLES_LAYER_ID,
  REFERENCE_IMAGE_HANDLES_SOURCE_ID,
  REFERENCE_IMAGE_RASTER_LAYER_ID,
  REFERENCE_IMAGE_SOURCE_ID,
} from '@/shared/reference-image/overlay-ids'
import {
  useHasReferenceImage,
  useReferenceImageAspectRatio,
  useReferenceImageObjectUrl,
  useReferenceImageLocked,
} from '@/shared/reference-image/reference-image-store'
import type { ImageCoords, OverlaySearchState } from '@/shared/reference-image/types'
import { DEFAULT_OVERLAY_OPACITY } from '@/shared/reference-image/types'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'

function resolveOverlayCorners(
  map: MaplibreMap,
  overlay: OverlaySearchState | undefined,
  aspectRatio: number,
): ImageCoords {
  if (overlay?.corners) return overlay.corners

  const center = map.getCenter()
  return computeInitialImageCoords(map, { lng: center.lng, lat: center.lat }, aspectRatio)
}

type ReferenceImageMapHandlers = {
  interactiveLayerIds: string[]
  onMouseDown: (event: MapLayerMouseEvent) => void
  onMouseMove: (event: MapLayerMouseEvent) => void
  onMouseUp: (event: MapLayerMouseEvent) => void
  onMouseLeave: (event: MapLayerMouseEvent) => void
}

const noopMapHandler = () => undefined

const emptyReferenceImageMapHandlers: ReferenceImageMapHandlers = {
  interactiveLayerIds: [],
  onMouseDown: noopMapHandler,
  onMouseMove: noopMapHandler,
  onMouseUp: noopMapHandler,
  onMouseLeave: noopMapHandler,
}

type ReferenceImageLayersProps = {
  imageUrl: string
  corners: ImageCoords
  opacity: number
  locked: boolean
}

function ReferenceImageLayers({ imageUrl, corners, opacity, locked }: ReferenceImageLayersProps) {
  return (
    <>
      <Source id={REFERENCE_IMAGE_SOURCE_ID} type="image" url={imageUrl} coordinates={corners} />
      <Layer
        id={REFERENCE_IMAGE_RASTER_LAYER_ID}
        type="raster"
        source={REFERENCE_IMAGE_SOURCE_ID}
        beforeId={MAP_CUSTOM_CONTENT_ANCHOR_LAYER_ID}
        paint={{
          'raster-opacity': opacity,
          'raster-fade-duration': 0,
        }}
      />
      <Source
        id={REFERENCE_IMAGE_HANDLES_SOURCE_ID}
        type="geojson"
        data={cornersToGeoJson(corners)}
      />
      <Layer
        id={REFERENCE_IMAGE_HANDLES_LAYER_ID}
        type="circle"
        source={REFERENCE_IMAGE_HANDLES_SOURCE_ID}
        layout={{
          visibility: locked ? 'none' : 'visible',
        }}
        paint={{
          'circle-radius': 8,
          'circle-color': '#38bdf8',
          'circle-stroke-color': '#0f172a',
          'circle-stroke-width': 2,
        }}
      />
    </>
  )
}

/**
 * Declarative reference-image layers plus `<Map>` pointer handlers for corner drag.
 * Spread `mapHandlers` onto `<Map>` and render `layers` as a child.
 */
export function useReferenceImageOverlay(options: { editable?: boolean } = {}) {
  const editable = options.editable ?? true
  const maps = useMap()
  const mapRef = maps[MAIN_MAP_ID]
  const map = mapRef?.getMap()
  const mapLoaded = useMapLoaded()
  const { updateSearch } = useIndexSearchNavigation()
  const overlay = Route.useSearch({ select: (search) => search.overlay })
  const imageUrl = useReferenceImageObjectUrl()
  const hasImage = useHasReferenceImage()
  const locked = useReferenceImageLocked()
  const aspectRatio = useReferenceImageAspectRatio()
  const overlayOpacity = overlay?.opacity ?? DEFAULT_OVERLAY_OPACITY
  const overlayCorners = overlay?.corners
  const [dragCorners, setDragCorners] = useState<ImageCoords | null>(null)
  const draggingCornerIndexRef = useRef<number | null>(null)
  const displayCorners = dragCorners ?? overlayCorners ?? null
  const cornersEditable = editable && !locked

  function persistOverlay(next: OverlaySearchState) {
    updateSearch({ overlay: next })
  }

  const debouncedPersistCorners = useDebouncedCallback(
    (corners: ImageCoords, opacity: number) => {
      persistOverlay({ corners, opacity })
    },
    { wait: 300 },
  )

  const persistInitialOverlay = useEffectEvent((corners: ImageCoords, opacity: number) => {
    persistOverlay({ corners, opacity })
  })

  useEffect(
    function placeInitialOverlayCorners() {
      if (!map || !mapLoaded || !hasImage || !imageUrl || overlayCorners) return

      const corners = resolveOverlayCorners(map, undefined, aspectRatio)
      persistInitialOverlay(corners, overlayOpacity)
    },
    [map, mapLoaded, hasImage, imageUrl, overlayCorners, aspectRatio, overlayOpacity],
  )

  const finishCornerDrag = useEffectEvent(() => {
    if (draggingCornerIndexRef.current === null || !map) return
    draggingCornerIndexRef.current = null
    setDragCorners(null)
    map.dragPan.enable()
    map.getCanvas().style.cursor = ''
  })

  const onMouseDown = useEffectEvent((event: MapLayerMouseEvent) => {
    if (!map || !cornersEditable) return

    const feature = event.features?.[0]
    const cornerIndex = feature?.properties?.cornerIndex
    if (typeof cornerIndex !== 'number') return

    event.preventDefault()
    draggingCornerIndexRef.current = cornerIndex
    map.dragPan.disable()
    map.getCanvas().style.cursor = 'grabbing'
  })

  const onMouseMove = useEffectEvent((event: MapLayerMouseEvent) => {
    const draggingCornerIndex = draggingCornerIndexRef.current
    if (!map || draggingCornerIndex === null) return

    setDragCorners((current) => {
      const baseCorners = current ?? overlayCorners
      if (!baseCorners) return current

      const nextCorners = baseCorners.map((corner, index) =>
        index === draggingCornerIndex ? ([event.lngLat.lng, event.lngLat.lat] as const) : corner,
      ) as ImageCoords

      debouncedPersistCorners(nextCorners, overlayOpacity)
      return nextCorners
    })
  })

  const onMouseUp = useEffectEvent((event: MapLayerMouseEvent) => {
    void event
    finishCornerDrag()
  })

  const onMouseLeave = useEffectEvent((event: MapLayerMouseEvent) => {
    void event
    finishCornerDrag()
  })

  const showOverlay = hasImage && imageUrl && displayCorners

  const mapHandlers: ReferenceImageMapHandlers =
    showOverlay && cornersEditable
      ? {
          interactiveLayerIds: [REFERENCE_IMAGE_HANDLES_LAYER_ID],
          onMouseDown,
          onMouseMove,
          onMouseUp,
          onMouseLeave,
        }
      : emptyReferenceImageMapHandlers

  const layers =
    showOverlay && imageUrl ? (
      <ReferenceImageLayers
        imageUrl={imageUrl}
        corners={displayCorners}
        opacity={overlayOpacity}
        locked={!cornersEditable}
      />
    ) : null

  return { mapHandlers, layers }
}
