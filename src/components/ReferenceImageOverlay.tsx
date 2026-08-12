import { MAP_CUSTOM_CONTENT_ANCHOR_LAYER_ID } from '@osm-editor-kit/osm-maplibre'
import { useDebouncer } from '@tanstack/react-pacer'
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

/**
 * State ownership for reference-image corners:
 *
 * - **dirtyCorners** (React): local edits / in-progress drag. Sole interactive source of truth.
 * - **URL `overlay.corners`**: shareable persistence + seed when dirty is null.
 * - Display = `dirtyCorners ?? urlCorners`. Never clear dirty on pointerup (that was snapping
 *   back to a stale URL and cancelling the drag). Pacer debounces URL writes; flush on end.
 *
 * Declarative `<Source coordinates={…}>` — no imperative `setCoordinates` (react-map-gl skill).
 */

function resolveOverlayCorners(
  map: MaplibreMap,
  overlay: OverlaySearchState | undefined,
  aspectRatio: number,
): ImageCoords {
  if (overlay?.corners) return overlay.corners

  const center = map.getCenter()
  return computeInitialImageCoords(map, { lng: center.lng, lat: center.lat }, aspectRatio)
}

function unprojectClientPoint(map: MaplibreMap, clientX: number, clientY: number) {
  const rect = map.getCanvas().getBoundingClientRect()
  return map.unproject([clientX - rect.left, clientY - rect.top])
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

type WindowDragListeners = {
  onMove: (event: PointerEvent) => void
  onUp: (event: PointerEvent) => void
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
  const cornersEditable = editable && !locked

  const [dirtyCorners, setDirtyCorners] = useState<ImageCoords | null>(null)
  const dirtyCornersRef = useRef<ImageCoords | null>(null)
  const draggingCornerIndexRef = useRef<number | null>(null)
  const windowListenersRef = useRef<WindowDragListeners | null>(null)

  // Reset local edits when the in-memory image is cleared or replaced (render-time adjust).
  const imageSessionKey = imageUrl ?? ''
  const [seenImageSessionKey, setSeenImageSessionKey] = useState(imageSessionKey)
  if (imageSessionKey !== seenImageSessionKey) {
    setSeenImageSessionKey(imageSessionKey)
    setDirtyCorners(null)
  }

  const displayCorners = dirtyCorners ?? overlayCorners ?? null

  const persistOverlayToUrl = useDebouncer(
    (corners: ImageCoords, opacity: number) => {
      updateSearch({ overlay: { corners, opacity } })
    },
    {
      wait: 300,
      onUnmount: (debouncer) => {
        debouncer.flush()
      },
    },
  )

  useEffect(
    function syncDirtyCornersRef() {
      dirtyCornersRef.current = dirtyCorners
      if (dirtyCorners === null) {
        persistOverlayToUrl.cancel()
      }
    },
    [dirtyCorners, persistOverlayToUrl],
  )

  const setDirtyCornersNow = useEffectEvent((corners: ImageCoords) => {
    dirtyCornersRef.current = corners
    setDirtyCorners(corners)
  })

  const scheduleUrlPersist = useEffectEvent((corners: ImageCoords) => {
    persistOverlayToUrl.maybeExecute(corners, overlayOpacity)
  })

  const commitCornersToUrl = useEffectEvent(() => {
    const corners = dirtyCornersRef.current
    if (corners) {
      persistOverlayToUrl.maybeExecute(corners, overlayOpacity)
    }
    persistOverlayToUrl.flush()
  })

  const detachWindowDragListeners = useEffectEvent(() => {
    const listeners = windowListenersRef.current
    if (!listeners) return
    window.removeEventListener('pointermove', listeners.onMove)
    window.removeEventListener('pointerup', listeners.onUp)
    window.removeEventListener('pointercancel', listeners.onUp)
    windowListenersRef.current = null
  })

  const persistInitialOverlay = useEffectEvent((corners: ImageCoords, opacity: number) => {
    updateSearch({ overlay: { corners, opacity } })
  })

  useEffect(
    function placeInitialOverlayCorners() {
      if (!map || !mapLoaded || !hasImage || !imageUrl) return
      if (dirtyCorners || overlayCorners) return

      const corners = resolveOverlayCorners(map, undefined, aspectRatio)
      // Write URL only — display picks up overlayCorners after navigate (no local/URL fight).
      persistInitialOverlay(corners, overlayOpacity)
    },
    [map, mapLoaded, hasImage, imageUrl, dirtyCorners, overlayCorners, aspectRatio, overlayOpacity],
  )

  useEffect(function cleanupWindowDragListenersOnUnmount() {
    return () => {
      detachWindowDragListeners()
    }
  }, [])

  const moveDraggedCorner = useEffectEvent((lng: number, lat: number) => {
    const draggingCornerIndex = draggingCornerIndexRef.current
    const baseCorners = dirtyCornersRef.current ?? overlayCorners
    if (draggingCornerIndex === null || !baseCorners) return

    const nextCorners = baseCorners.map((corner, index) =>
      index === draggingCornerIndex ? ([lng, lat] as const) : corner,
    ) as ImageCoords

    setDirtyCornersNow(nextCorners)
    scheduleUrlPersist(nextCorners)
  })

  const finishCornerDrag = useEffectEvent(() => {
    if (draggingCornerIndexRef.current === null) return

    draggingCornerIndexRef.current = null
    detachWindowDragListeners()
    commitCornersToUrl()

    if (map) {
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
    }
  })

  const onMouseDown = useEffectEvent((event: MapLayerMouseEvent) => {
    if (!map || !cornersEditable) return

    const feature = event.features?.[0]
    const cornerIndex = feature?.properties?.cornerIndex
    if (typeof cornerIndex !== 'number') return

    event.preventDefault()
    draggingCornerIndexRef.current = cornerIndex
    // Seed dirty from URL on first edit so display does not depend on a pending navigate.
    if (!dirtyCornersRef.current && overlayCorners) {
      setDirtyCornersNow(overlayCorners)
    }
    map.dragPan.disable()
    map.getCanvas().style.cursor = 'grabbing'

    detachWindowDragListeners()
    const onMove = (pointerEvent: PointerEvent) => {
      const { lng, lat } = unprojectClientPoint(map, pointerEvent.clientX, pointerEvent.clientY)
      moveDraggedCorner(lng, lat)
    }
    const onUp = () => {
      finishCornerDrag()
    }
    windowListenersRef.current = { onMove, onUp }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  })

  const onMouseMove = useEffectEvent((event: MapLayerMouseEvent) => {
    // Window listeners own the drag; map move only updates the grab cursor when idle.
    if (draggingCornerIndexRef.current !== null) return
    if (!cornersEditable || !map) return

    const overHandle = event.features?.some(
      (feature) => feature.layer?.id === REFERENCE_IMAGE_HANDLES_LAYER_ID,
    )
    map.getCanvas().style.cursor = overHandle ? 'grab' : ''
  })

  const onMouseUp = useEffectEvent((event: MapLayerMouseEvent) => {
    void event
    finishCornerDrag()
  })

  const onMouseLeave = useEffectEvent((event: MapLayerMouseEvent) => {
    void event
    // Do not end the drag — the pointer often leaves the canvas while stretching a corner.
    if (draggingCornerIndexRef.current !== null || !map) return
    map.getCanvas().style.cursor = ''
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
    showOverlay && imageUrl && displayCorners ? (
      <ReferenceImageLayers
        imageUrl={imageUrl}
        corners={displayCorners}
        opacity={overlayOpacity}
        locked={!cornersEditable}
      />
    ) : null

  return { mapHandlers, layers }
}
