import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { ImageCoords, OverlaySearchState } from './types'
import { DEFAULT_OVERLAY_OPACITY } from './types'

type CompactOverlayPayload = {
  c: ImageCoords
  o: number
}

const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6

function isImageCoord(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function isImageCoords(value: unknown): value is ImageCoords {
  return Array.isArray(value) && value.length === 4 && value.every(isImageCoord)
}

function normalizeOverlay(payload: CompactOverlayPayload): OverlaySearchState {
  return {
    corners: payload.c.map(
      ([lng, lat]) => [roundCoord(lng), roundCoord(lat)] as [number, number],
    ) as ImageCoords,
    opacity: Math.min(1, Math.max(0, payload.o)),
  }
}

export function encodeOverlaySearch(state: OverlaySearchState): string {
  const payload: CompactOverlayPayload = {
    c: state.corners.map(
      ([lng, lat]) => [roundCoord(lng), roundCoord(lat)] as [number, number],
    ) as ImageCoords,
    o: Math.round(state.opacity * 100) / 100,
  }
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodeOverlaySearch(value: string | undefined): OverlaySearchState | undefined {
  if (!value) return undefined

  try {
    const json = decompressFromEncodedURIComponent(value)
    if (!json) return undefined
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return undefined

    const record = parsed as Partial<CompactOverlayPayload>
    if (!isImageCoords(record.c)) return undefined

    const opacity =
      typeof record.o === 'number' && Number.isFinite(record.o) ? record.o : DEFAULT_OVERLAY_OPACITY
    return normalizeOverlay({ c: record.c, o: opacity })
  } catch {
    return undefined
  }
}
