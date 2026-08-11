/** Four geographic corners in clockwise order: TL, TR, BR, BL. */
export type ImageCoord = [lng: number, lat: number]

export type ImageCoords = [ImageCoord, ImageCoord, ImageCoord, ImageCoord]

export type OverlaySearchState = {
  corners: ImageCoords
  opacity: number
}

export const DEFAULT_OVERLAY_OPACITY = 0.6
