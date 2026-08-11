import { MAP_CUSTOM_CONTENT_ANCHOR_LAYER_ID } from '@osm-editor-kit/osm-maplibre'
import type { FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, ImageSource, Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl'
import {
  REFERENCE_IMAGE_HANDLES_LAYER_ID,
  REFERENCE_IMAGE_HANDLES_SOURCE_ID,
  REFERENCE_IMAGE_RASTER_LAYER_ID,
  REFERENCE_IMAGE_SOURCE_ID,
} from './overlay-ids'
import type { ImageCoords } from './types'

type ImageOverlayControllerOptions = {
  onCoordinatesChange?: (corners: ImageCoords) => void
}

function cornersToGeoJson(corners: ImageCoords): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: corners.map((coordinates, cornerIndex) => ({
      type: 'Feature',
      properties: { cornerIndex },
      geometry: {
        type: 'Point',
        coordinates,
      },
    })),
  }
}

export class ImageOverlayController {
  private map: MaplibreMap
  private corners: ImageCoords | null = null
  private locked = true
  private draggingCornerIndex: number | null = null
  private onCoordinatesChange?: (corners: ImageCoords) => void

  private readonly handleMouseDown = (event: MapMouseEvent) => {
    if (this.locked || this.corners === null) return

    const features = this.map.queryRenderedFeatures(event.point, {
      layers: [REFERENCE_IMAGE_HANDLES_LAYER_ID],
    })
    const feature = features[0]
    const cornerIndex = feature?.properties?.cornerIndex
    if (typeof cornerIndex !== 'number') return

    event.preventDefault()
    this.draggingCornerIndex = cornerIndex
    this.map.dragPan.disable()
    this.map.getCanvas().style.cursor = 'grabbing'
  }

  private readonly handleMouseMove = (event: MapMouseEvent) => {
    if (this.draggingCornerIndex === null || this.corners === null) return

    const nextCorners = this.corners.map((corner, index) =>
      index === this.draggingCornerIndex ? ([event.lngLat.lng, event.lngLat.lat] as const) : corner,
    ) as ImageCoords

    this.applyCoordinates(nextCorners, { notify: true })
  }

  private readonly handleMouseUp = () => {
    if (this.draggingCornerIndex === null) return
    this.draggingCornerIndex = null
    this.map.dragPan.enable()
    this.map.getCanvas().style.cursor = ''
  }

  constructor(map: MaplibreMap, options?: ImageOverlayControllerOptions) {
    this.map = map
    this.onCoordinatesChange = options?.onCoordinatesChange
    this.map.on('mousedown', this.handleMouseDown)
    this.map.on('mousemove', this.handleMouseMove)
    this.map.on('mouseup', this.handleMouseUp)
    this.map.on('mouseleave', this.handleMouseUp)
  }

  destroy() {
    this.unmount()
    this.map.off('mousedown', this.handleMouseDown)
    this.map.off('mousemove', this.handleMouseMove)
    this.map.off('mouseup', this.handleMouseUp)
    this.map.off('mouseleave', this.handleMouseUp)
  }

  mountImage(imageUrl: string, corners: ImageCoords, opacity: number) {
    this.corners = corners

    if (!this.map.getSource(REFERENCE_IMAGE_SOURCE_ID)) {
      this.map.addSource(REFERENCE_IMAGE_SOURCE_ID, {
        type: 'image',
        url: imageUrl,
        coordinates: corners,
      })

      this.map.addLayer(
        {
          id: REFERENCE_IMAGE_RASTER_LAYER_ID,
          type: 'raster',
          source: REFERENCE_IMAGE_SOURCE_ID,
          paint: {
            'raster-opacity': opacity,
            'raster-fade-duration': 0,
          },
        },
        MAP_CUSTOM_CONTENT_ANCHOR_LAYER_ID,
      )

      this.ensureHandleLayers()
    } else {
      const imageSource = this.map.getSource(REFERENCE_IMAGE_SOURCE_ID) as ImageSource
      imageSource.updateImage({ url: imageUrl, coordinates: corners })
    }

    this.setOpacity(opacity)
    this.syncHandles()
  }

  setCoordinates(corners: ImageCoords) {
    this.applyCoordinates(corners, { notify: false })
  }

  setOpacity(opacity: number) {
    if (!this.map.getLayer(REFERENCE_IMAGE_RASTER_LAYER_ID)) return
    this.map.setPaintProperty(REFERENCE_IMAGE_RASTER_LAYER_ID, 'raster-opacity', opacity)
  }

  setLocked(locked: boolean) {
    this.locked = locked
    this.syncHandleVisibility()
  }

  unmount() {
    if (this.draggingCornerIndex !== null) {
      try {
        this.handleMouseUp()
      } catch {
        // Map canvas may already be torn down.
      }
    }

    if (!this.map.getStyle()?.layers) {
      this.corners = null
      return
    }

    try {
      if (this.map.getLayer(REFERENCE_IMAGE_HANDLES_LAYER_ID)) {
        this.map.removeLayer(REFERENCE_IMAGE_HANDLES_LAYER_ID)
      }
      if (this.map.getLayer(REFERENCE_IMAGE_RASTER_LAYER_ID)) {
        this.map.removeLayer(REFERENCE_IMAGE_RASTER_LAYER_ID)
      }
      if (this.map.getSource(REFERENCE_IMAGE_HANDLES_SOURCE_ID)) {
        this.map.removeSource(REFERENCE_IMAGE_HANDLES_SOURCE_ID)
      }
      if (this.map.getSource(REFERENCE_IMAGE_SOURCE_ID)) {
        this.map.removeSource(REFERENCE_IMAGE_SOURCE_ID)
      }
    } catch {
      // Style may be removed while layers are being torn down.
    }

    this.corners = null
  }

  private ensureHandleLayers() {
    if (this.map.getSource(REFERENCE_IMAGE_HANDLES_SOURCE_ID)) return

    this.map.addSource(REFERENCE_IMAGE_HANDLES_SOURCE_ID, {
      type: 'geojson',
      data: cornersToGeoJson(
        this.corners ?? [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ),
    })

    this.map.addLayer({
      id: REFERENCE_IMAGE_HANDLES_LAYER_ID,
      type: 'circle',
      source: REFERENCE_IMAGE_HANDLES_SOURCE_ID,
      paint: {
        'circle-radius': 8,
        'circle-color': '#38bdf8',
        'circle-stroke-color': '#0f172a',
        'circle-stroke-width': 2,
      },
    })
  }

  private applyCoordinates(corners: ImageCoords, { notify }: { notify: boolean }) {
    this.corners = corners

    const imageSource = this.map.getSource(REFERENCE_IMAGE_SOURCE_ID) as ImageSource | undefined
    imageSource?.setCoordinates(corners)
    this.syncHandles()

    if (notify) {
      this.onCoordinatesChange?.(corners)
    }
  }

  private syncHandles() {
    if (!this.corners) return
    const source = this.map.getSource(REFERENCE_IMAGE_HANDLES_SOURCE_ID) as
      | GeoJSONSource
      | undefined
    source?.setData(cornersToGeoJson(this.corners))
    this.syncHandleVisibility()
  }

  private syncHandleVisibility() {
    if (!this.map.getLayer(REFERENCE_IMAGE_HANDLES_LAYER_ID)) return
    this.map.setLayoutProperty(
      REFERENCE_IMAGE_HANDLES_LAYER_ID,
      'visibility',
      this.locked ? 'none' : 'visible',
    )
  }
}
