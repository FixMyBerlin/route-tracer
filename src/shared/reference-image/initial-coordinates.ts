import type { Map as MaplibreMap } from 'maplibre-gl'
import type { ImageCoords } from './types'

const DEFAULT_SCREEN_WIDTH_PX = 280

export function computeInitialImageCoords(
  map: MaplibreMap,
  center: { lng: number; lat: number },
  aspectRatio: number,
  screenWidthPx = DEFAULT_SCREEN_WIDTH_PX,
): ImageCoords {
  const centerPoint = map.project([center.lng, center.lat])
  const halfWidth = screenWidthPx / 2
  const halfHeight = halfWidth / aspectRatio

  const topLeft = map.unproject([centerPoint.x - halfWidth, centerPoint.y - halfHeight])
  const topRight = map.unproject([centerPoint.x + halfWidth, centerPoint.y - halfHeight])
  const bottomRight = map.unproject([centerPoint.x + halfWidth, centerPoint.y + halfHeight])
  const bottomLeft = map.unproject([centerPoint.x - halfWidth, centerPoint.y + halfHeight])

  return [
    [topLeft.lng, topLeft.lat],
    [topRight.lng, topRight.lat],
    [bottomRight.lng, bottomRight.lat],
    [bottomLeft.lng, bottomLeft.lat],
  ]
}
