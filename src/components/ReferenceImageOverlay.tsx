import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useNavigate } from '@tanstack/react-router'
import type { Map as MaplibreMap } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { Route } from '@/routes/index'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { ImageOverlayController } from '@/shared/reference-image/image-overlay-controller'
import { computeInitialImageCoords } from '@/shared/reference-image/initial-coordinates'
import { encodeOverlaySearch } from '@/shared/reference-image/overlay-search-codec'
import {
  useHasReferenceImage,
  useReferenceImageAspectRatio,
  useReferenceImageObjectUrl,
  useReferenceImageLocked,
} from '@/shared/reference-image/reference-image-store'
import type { ImageCoords, OverlaySearchState } from '@/shared/reference-image/types'
import { DEFAULT_OVERLAY_OPACITY } from '@/shared/reference-image/types'
import { serializeIndexSearch } from '@/shared/routing/search-schema'

function resolveOverlayCorners(
  map: MaplibreMap,
  overlay: OverlaySearchState | undefined,
  aspectRatio: number,
): ImageCoords {
  if (overlay?.corners) return overlay.corners

  const center = map.getCenter()
  return computeInitialImageCoords(map, { lng: center.lng, lat: center.lat }, aspectRatio)
}

export function ReferenceImageOverlay() {
  const maps = useMap()
  const map = maps[MAIN_MAP_ID]?.getMap()
  const navigate = useNavigate({ from: Route.fullPath })
  const overlay = Route.useSearch({ select: (search) => search.overlay })
  const imageUrl = useReferenceImageObjectUrl()
  const hasImage = useHasReferenceImage()
  const locked = useReferenceImageLocked()
  const aspectRatio = useReferenceImageAspectRatio()
  const controllerRef = useRef<ImageOverlayController | null>(null)
  const mountedImageUrlRef = useRef<string | null>(null)

  const persistOverlay = (next: OverlaySearchState) => {
    void navigate({
      search: (prev) => ({
        ...serializeIndexSearch(prev),
        overlay: encodeOverlaySearch(next),
      }),
      replace: true,
    })
  }

  const debouncedPersistCorners = useDebouncedCallback(
    (corners: ImageCoords, opacity: number) => {
      persistOverlay({ corners, opacity })
    },
    { wait: 300 },
  )

  useEffect(() => {
    if (!map) return

    const controller = new ImageOverlayController(map, {
      onCoordinatesChange: (corners) => {
        debouncedPersistCorners(corners, overlay?.opacity ?? DEFAULT_OVERLAY_OPACITY)
      },
    })
    controllerRef.current = controller

    return () => {
      controller.destroy()
      controllerRef.current = null
      mountedImageUrlRef.current = null
    }
  }, [map, debouncedPersistCorners, overlay?.opacity])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller || !map || !imageUrl || !hasImage) {
      controllerRef.current?.unmount()
      mountedImageUrlRef.current = null
      return
    }

    const opacity = overlay?.opacity ?? DEFAULT_OVERLAY_OPACITY

    if (mountedImageUrlRef.current !== imageUrl) {
      const corners = resolveOverlayCorners(map, overlay, aspectRatio)
      controller.mountImage(imageUrl, corners, opacity)
      mountedImageUrlRef.current = imageUrl

      if (!overlay?.corners) {
        persistOverlay({ corners, opacity })
      }
      return
    }

    if (overlay?.corners) {
      controller.setCoordinates(overlay.corners)
    }
    controller.setOpacity(opacity)
  }, [
	map,
	imageUrl,
	hasImage,
	overlay,
	aspectRatio
])

  useEffect(() => {
    controllerRef.current?.setLocked(locked)
  }, [locked])

  return null
}
