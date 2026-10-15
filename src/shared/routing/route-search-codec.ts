import type { Position } from 'geojson'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import {
  segmentsToFlaggedWaypoints,
  type RouteSegment,
  type SegmentKind,
} from '@/shared/routing/route-segments'

/**
 * What the `route` URL param holds: the decisions, not the geometry. The geometry is rebuilt
 * from the waypoints once roads are loaded; `sectionLengths` (meters between consecutive
 * waypoints, as saved) shows which stretches changed when OSM did.
 */
export type RouteSearchState = {
  waypoints: FlaggedWaypoint[]
  sectionLengths?: number[]
}

const FLAG_SNAPPED = 1
const FLAG_PINNED = 2

/** `[lon, lat, flags]` */
type CompactWaypoint = [number, number, number]

type CompactRouteV2 = {
  v: 2
  w: CompactWaypoint[]
  l?: number[]
}

/** v1 stored the drawn stretches themselves. Still decoded so old links keep working. */
type CompactSegmentV1 = {
  k: 's' | 'm'
  c: Position[]
  w?: number[]
}

const roundCoord = (value: number) => Math.round(value * 1e6) / 1e6

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function isPosition(value: unknown): value is Position {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1])
  )
}

function isCompactWaypoint(value: unknown): value is CompactWaypoint {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    Number.isInteger(value[2])
  )
}

function isCompactSegmentV1(value: unknown): value is CompactSegmentV1 {
  if (typeof value !== 'object' || value == null) return false
  const segment = value as CompactSegmentV1
  if (segment.k !== 's' && segment.k !== 'm') return false
  return Array.isArray(segment.c) && segment.c.length >= 2 && segment.c.every(isPosition)
}

function toCompactWaypoint(waypoint: FlaggedWaypoint): CompactWaypoint {
  const flags = (waypoint.snapped ? FLAG_SNAPPED : 0) | (waypoint.pinned ? FLAG_PINNED : 0)
  return [roundCoord(waypoint.lon), roundCoord(waypoint.lat), flags]
}

function fromCompactWaypoint([lon, lat, flags]: CompactWaypoint): FlaggedWaypoint {
  return {
    lon: roundCoord(lon),
    lat: roundCoord(lat),
    snapped: (flags & FLAG_SNAPPED) !== 0,
    pinned: (flags & FLAG_PINNED) !== 0,
  }
}

function fromCompactSegmentV1(segment: CompactSegmentV1, index: number): RouteSegment {
  const segmentKind: SegmentKind = segment.k === 's' ? 'snapped' : 'manual'
  return {
    segment_index: index,
    segment_kind: segmentKind,
    coordinates: segment.c.map(([lng, lat]) => [roundCoord(lng ?? 0), roundCoord(lat ?? 0)]),
  }
}

export function encodeRouteSearch(state: RouteSearchState): string {
  const payload: CompactRouteV2 = {
    v: 2,
    w: state.waypoints.map(toCompactWaypoint),
    ...(state.sectionLengths?.length ? { l: state.sectionLengths.map(Math.round) } : {}),
  }
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

function decodeV2(record: Partial<CompactRouteV2>): RouteSearchState | undefined {
  if (!Array.isArray(record.w) || !record.w.every(isCompactWaypoint)) return undefined
  const waypoints = record.w.map(fromCompactWaypoint)
  const lengths = record.l
  const sectionLengths =
    Array.isArray(lengths) &&
    lengths.length === waypoints.length - 1 &&
    lengths.every(isFiniteNumber)
      ? lengths
      : undefined
  return { waypoints, ...(sectionLengths ? { sectionLengths } : {}) }
}

export function decodeRouteSearch(value: string | undefined): RouteSearchState | undefined {
  if (!value) return undefined

  try {
    const json = decompressFromEncodedURIComponent(value)
    if (!json) return undefined
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return undefined

    if ((parsed as { v?: unknown }).v === 2) return decodeV2(parsed as Partial<CompactRouteV2>)

    const v1 = parsed as { s?: unknown }
    if (!Array.isArray(v1.s) || !v1.s.every(isCompactSegmentV1)) return undefined
    const waypoints = segmentsToFlaggedWaypoints(v1.s.map(fromCompactSegmentV1))
    return waypoints.length > 0 ? { waypoints } : undefined
  } catch {
    return undefined
  }
}
