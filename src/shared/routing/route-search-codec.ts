import type { Position } from 'geojson'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { RouteSegment, SegmentKind } from '@/shared/routing/route-segments'

type CompactSegment = {
  k: 's' | 'm'
  c: Position[]
  w?: number[]
}

type CompactRoutePayload = {
  s: CompactSegment[]
}

const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

function isCompactSegment(value: unknown): value is CompactSegment {
  if (typeof value !== 'object' || value == null) return false
  const segment = value as CompactSegment
  if (segment.k !== 's' && segment.k !== 'm') return false
  if (!Array.isArray(segment.c) || segment.c.length < 2 || !segment.c.every(isPosition))
    return false
  if (
    segment.w != null &&
    (!Array.isArray(segment.w) || !segment.w.every((id) => Number.isInteger(id)))
  ) {
    return false
  }
  return true
}

function toCompactSegment(segment: RouteSegment): CompactSegment {
  return {
    k: segment.segment_kind === 'snapped' ? 's' : 'm',
    c: segment.coordinates.map(([lng, lat]) => [roundCoord(lng ?? 0), roundCoord(lat ?? 0)]),
    ...(segment.osm_way_ids?.length ? { w: segment.osm_way_ids } : {}),
  }
}

function fromCompactSegment(segment: CompactSegment, index: number): RouteSegment {
  const segmentKind: SegmentKind = segment.k === 's' ? 'snapped' : 'manual'
  return {
    segment_index: index,
    segment_kind: segmentKind,
    coordinates: segment.c.map(([lng, lat]) => [roundCoord(lng ?? 0), roundCoord(lat ?? 0)]),
    ...(segment.w?.length ? { osm_way_ids: segment.w } : {}),
  }
}

export function encodeRouteSearch(segments: RouteSegment[]): string {
  const payload: CompactRoutePayload = {
    s: segments.map(toCompactSegment),
  }
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

export function decodeRouteSearch(value: string | undefined): RouteSegment[] | undefined {
  if (!value) return undefined

  try {
    const json = decompressFromEncodedURIComponent(value)
    if (!json) return undefined
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return undefined

    const record = parsed as Partial<CompactRoutePayload>
    if (!Array.isArray(record.s) || !record.s.every(isCompactSegment)) return undefined

    return record.s.map(fromCompactSegment)
  } catch {
    return undefined
  }
}
