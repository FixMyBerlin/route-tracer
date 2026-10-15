import type { Position } from 'geojson'
import { sliceLineByDistance } from '@/shared/routing/auto-snap/line-deviation'
import { lonLatOf } from '@/shared/routing/auto-snap/local-meters'
import { createSegmentIndex } from '@/shared/routing/auto-snap/point-index'
import { haversineMeters } from '@/shared/routing/haversine'

export type TrackMismatch = {
  /** Stable while the mismatch stays roughly in place: `m-` + fromMeters rounded down to 25 m. */
  id: string
  /** Along-track range of the mismatch. */
  fromMeters: number
  toMeters: number
  /** Largest distance between route and track inside the range. */
  maxDistanceMeters: number
  /** The track slice for this range (for highlighting), from sliceLineByDistance. */
  coordinates: Position[]
}

export type CompareOptions = {
  thresholdMeters?: number
  stepMeters?: number
  minLengthMeters?: number
  mergeGapMeters?: number
}

/** Farthest distance searched for; anything farther counts as this distance (keeps long searches cheap). */
const SEARCH_RADIUS_METERS = 500
const ID_BUCKET_METERS = 25

type Mark = { alongMeters: number; distanceMeters: number }
type Range = { fromMeters: number; toMeters: number; maxDistanceMeters: number }
type Sample = { position: Position; alongMeters: number }

/** Cumulative along-line distance in meters at every vertex; the first entry is 0. */
function cumulativeMeters(line: Position[]) {
  const cumulative = [0]
  for (let index = 1; index < line.length; index += 1) {
    const [lon1, lat1] = lonLatOf(line[index - 1] ?? [])
    const [lon2, lat2] = lonLatOf(line[index] ?? [])
    cumulative.push((cumulative[index - 1] ?? 0) + haversineMeters(lat1, lon1, lat2, lon2))
  }
  return cumulative
}

/** Position `t` of the way along segment `index` of `line`, in lon/lat. */
function positionOnSegment(line: Position[], index: number, t: number): Position {
  const [lon1, lat1] = lonLatOf(line[index] ?? [])
  const [lon2, lat2] = lonLatOf(line[index + 1] ?? [])
  return [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t]
}

/** Points every `stepMeters` along `line`, the last vertex included. */
function sampleLine(line: Position[], cumulative: number[], stepMeters: number): Sample[] {
  if (line.length === 0) return []
  if (line.length === 1) return [{ position: line[0] ?? [], alongMeters: 0 }]

  const total = cumulative.at(-1) ?? 0
  const count = Math.max(1, Math.ceil(total / stepMeters))
  const samples: Sample[] = []
  let index = 0
  for (let step = 0; step <= count; step += 1) {
    const alongMeters = Math.min(total, step * stepMeters)
    while (index < line.length - 2 && (cumulative[index + 1] ?? 0) < alongMeters) index += 1
    const segmentStart = cumulative[index] ?? 0
    const segmentLength = (cumulative[index + 1] ?? 0) - segmentStart
    const t =
      segmentLength === 0
        ? 0
        : Math.min(1, Math.max(0, (alongMeters - segmentStart) / segmentLength))
    samples.push({ position: positionOnSegment(line, index, t), alongMeters })
  }
  return samples
}

/** Consecutive marks become one range; marks more than 1.5 steps apart start a new one. */
function groupMarks(marks: Mark[], stepMeters: number): Range[] {
  const ranges: Range[] = []
  for (const mark of marks) {
    const last = ranges.at(-1)
    if (last && mark.alongMeters - last.toMeters <= stepMeters * 1.5) {
      last.toMeters = mark.alongMeters
      last.maxDistanceMeters = Math.max(last.maxDistanceMeters, mark.distanceMeters)
    } else {
      ranges.push({
        fromMeters: mark.alongMeters,
        toMeters: mark.alongMeters,
        maxDistanceMeters: mark.distanceMeters,
      })
    }
  }
  return ranges
}

/** Joins ranges whose gap is below `gapMeters`. Input must be sorted by position. */
function mergeRanges(ranges: Range[], gapMeters: number): Range[] {
  const merged: Range[] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range.fromMeters - last.toMeters < gapMeters) {
      last.toMeters = range.toMeters
      last.maxDistanceMeters = Math.max(last.maxDistanceMeters, range.maxDistanceMeters)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

/**
 * Where the route does not follow the track. Two directions:
 * (a) the track walked every stepMeters: samples farther than threshold from the route polyline mark their along-track position as mismatched;
 * (b) the route walked every stepMeters: samples farther than threshold from the track are detours; map each to its along-track position (nearest point on the track, locateAlongLine without monotonic constraint) and mark it too.
 * Turn marked positions into ranges (consecutive samples), merge ranges closer than mergeGapMeters, pad each by stepMeters/2 clamped to the track, drop ranges shorter than minLengthMeters unless maxDistance >= 2*threshold. Returns ranges sorted by fromMeters.
 */
export function findTrackMismatches(
  track: Position[],
  route: Position[],
  options: CompareOptions = {},
): TrackMismatch[] {
  const threshold = options.thresholdMeters ?? 20
  const step = options.stepMeters ?? 10
  const minLength = options.minLengthMeters ?? 15
  const mergeGap = options.mergeGapMeters ?? 30
  if (track.length === 0) return []

  const trackCumulative = cumulativeMeters(track)
  const routeCumulative = cumulativeMeters(route)
  const trackTotal = trackCumulative.at(-1) ?? 0
  const trackIndex = createSegmentIndex(track)
  const routeIndex = createSegmentIndex(route)
  const radius = Math.max(SEARCH_RADIUS_METERS, threshold)

  const marks: Mark[] = []
  for (const sample of sampleLine(track, trackCumulative, step)) {
    const hit = routeIndex.nearest(sample.position, radius)
    if (hit && hit.distanceMeters <= threshold) continue
    marks.push({ alongMeters: sample.alongMeters, distanceMeters: hit?.distanceMeters ?? radius })
  }
  for (const sample of sampleLine(route, routeCumulative, step)) {
    const hit = trackIndex.nearest(sample.position, radius)
    if (!hit || hit.distanceMeters <= threshold) continue
    const segmentStart = trackCumulative[hit.segmentIndex] ?? 0
    const segmentLength = (trackCumulative[hit.segmentIndex + 1] ?? 0) - segmentStart
    marks.push({
      alongMeters: segmentStart + hit.t * segmentLength,
      distanceMeters: hit.distanceMeters,
    })
  }
  if (marks.length === 0) return []
  marks.sort((a, b) => a.alongMeters - b.alongMeters)

  const padMeters = step / 2
  return mergeRanges(groupMarks(marks, step), mergeGap)
    .map((range) => ({
      fromMeters: Math.max(0, range.fromMeters - padMeters),
      toMeters: Math.min(trackTotal, range.toMeters + padMeters),
      maxDistanceMeters: range.maxDistanceMeters,
    }))
    .filter(
      (range) =>
        range.toMeters - range.fromMeters >= minLength || range.maxDistanceMeters >= 2 * threshold,
    )
    .map((range) => ({
      id: `m-${Math.floor(range.fromMeters / ID_BUCKET_METERS) * ID_BUCKET_METERS}`,
      fromMeters: range.fromMeters,
      toMeters: range.toMeters,
      maxDistanceMeters: range.maxDistanceMeters,
      coordinates: sliceLineByDistance(track, range.fromMeters, range.toMeters),
    }))
}
