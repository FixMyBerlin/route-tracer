import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useNavigate } from '@tanstack/react-router'
import type { Map as MaplibreMap } from 'maplibre-gl'
import { useCallback, useEffect, useRef } from 'react'
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
  'use no memo'

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

  // Derive primitives during render. Do not put `overlay?.opacity` in useEffect deps —
  // React Compiler rewrites that comparison to `overlay.opacity` and crashes when overlay
  // is undefined. Same for `overlay.corners`.
  const overlayOpacity = overlay?.opacity ?? DEFAULT_OVERLAY_OPACITY
  const overlayCorners = overlay?.corners
  const overlayOpacityRef = useRef(overlayOpacity)

  useEffect(() => {
    overlayOpacityRef.current = overlayOpacity
  }, [overlayOpacity])

  const persistOverlay = useCallback(
    (next: OverlaySearchState) => {
      void navigate({
        search: (prev) => ({
          ...serializeIndexSearch(prev),
          overlay: encodeOverlaySearch(next),
        }),
        replace: true,
      })
    },
    [navigate],
  )

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
        debouncedPersistCorners(corners, overlayOpacityRef.current)
      },
    })
    controllerRef.current = controller

    return () => {
      controller.destroy()
      controllerRef.current = null
      mountedImageUrlRef.current = null
    }
  }, [map, debouncedPersistCorners])

  useEffect(() => {
    const controller = controllerRef.current
    if (!controller || !map || !imageUrl || !hasImage) {
      controllerRef.current?.unmount()
      mountedImageUrlRef.current = null
      return
    }

    if (mountedImageUrlRef.current !== imageUrl) {
      const corners = overlayCorners ?? resolveOverlayCorners(map, undefined, aspectRatio)
      controller.mountImage(imageUrl, corners, overlayOpacity)
      mountedImageUrlRef.current = imageUrl

      if (!overlayCorners) {
        persistOverlay({ corners, opacity: overlayOpacity })
      }
      return
    }

    // Corners stay with the controller after mount (drag + debounced URL persist).
    // Only sync opacity from URL-derived state here.
    controller.setOpacity(overlayOpacity)
  }, [map, imageUrl, hasImage, overlayOpacity, overlayCorners, aspectRatio, persistOverlay])

  useEffect(() => {
    controllerRef.current?.setLocked(locked)
  }, [locked])

  return null
}
