import type { MapBounds } from '@osm-editor-kit/osm-data'
import type { Position } from 'geojson'
import { haversineMeters } from '@/shared/routing/haversine'

/** One box to ask the community server for. */
export type LineRequest = MapBounds

export type PlanLineRequestsOptions = {
  /** Roads this far from the line are needed too, so every box is padded by it. */
  bufferMeters?: number
  /** Largest box the planner grows to. */
  maxAreaM2?: number
  /**
   * Smallest share of a box that the buffered line fills, once the box is past
   * `FILL_CHECK_AREA_M2`. Below it the box is mostly empty ground, so the next box starts instead.
   */
  minFill?: number
  /** True when the roads at this point are already loaded. */
  isCovered?: (lon: number, lat: number) => boolean
}

export const DEFAULT_BUFFER_METERS = 60
export const DEFAULT_MAX_AREA_M2 = 2_000_000
export const DEFAULT_MIN_FILL = 0.3

/** Boxes this small are always grown: the fill ratio is meaningless at a few hundred metres. */
const FILL_CHECK_AREA_M2 = 250_000
/** Spacing of the samples that stand in for the line; roads between two samples are still inside a 60 m band. */
const SAMPLE_METERS = 25
const METERS_PER_DEGREE_LAT = 110_540

type Sample = {
  lon: number
  lat: number
  /** Metres along the line from its start. */
  distance: number
  /** Unit normal to the line here, in metres east and north. */
  normal: { east: number; north: number }
}

const toBounds = (lonLat: { lon: number; lat: number }): MapBounds => ({
  south: lonLat.lat,
  north: lonLat.lat,
  west: lonLat.lon,
  east: lonLat.lon,
})

/** Area of a lon/lat box in square metres, from its two sides measured along the middle. */
export function boundsAreaM2(bounds: MapBounds) {
  const midLat = (bounds.south + bounds.north) / 2
  const midLon = (bounds.west + bounds.east) / 2
  const width = haversineMeters(midLat, bounds.west, midLat, bounds.east)
  const height = haversineMeters(bounds.south, midLon, bounds.north, midLon)
  return width * height
}

function padBounds(bounds: MapBounds, bufferMeters: number): MapBounds {
  const midLat = ((bounds.south + bounds.north) / 2) * (Math.PI / 180)
  const latBuffer = bufferMeters / METERS_PER_DEGREE_LAT
  const lonBuffer = bufferMeters / (METERS_PER_DEGREE_LAT * Math.max(Math.cos(midLat), 0.01))
  return {
    south: bounds.south - latBuffer,
    north: bounds.north + latBuffer,
    west: bounds.west - lonBuffer,
    east: bounds.east + lonBuffer,
  }
}

function containsPoint(bounds: MapBounds, lon: number, lat: number) {
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north
}

/** Points along the line about `SAMPLE_METERS` apart, with the distance and normal at each. */
function sampleLine(line: Position[]): Sample[] {
  const vertices = line.map(([lon = 0, lat = 0]) => ({ lon, lat }))
  const points: { lon: number; lat: number; distance: number }[] = []
  let distance = 0
  const push = (lon: number, lat: number) => {
    const last = points.at(-1)
    if (last) distance += haversineMeters(last.lat, last.lon, lat, lon)
    points.push({ lon, lat, distance })
  }

  const [first] = vertices
  if (first) push(first.lon, first.lat)
  for (let index = 1; index < vertices.length; index += 1) {
    const from = vertices[index - 1]
    const to = vertices[index]
    if (!from || !to) continue
    const length = haversineMeters(from.lat, from.lon, to.lat, to.lon)
    const steps = Math.ceil(length / SAMPLE_METERS)
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      push(from.lon + (to.lon - from.lon) * t, from.lat + (to.lat - from.lat) * t)
    }
  }

  return points.map((point, index) => {
    const before = points[Math.max(0, index - 1)] ?? point
    const after = points[Math.min(points.length - 1, index + 1)] ?? point
    const midLat = point.lat * (Math.PI / 180)
    const east = (after.lon - before.lon) * METERS_PER_DEGREE_LAT * Math.cos(midLat)
    const north = (after.lat - before.lat) * METERS_PER_DEGREE_LAT
    const length = Math.hypot(east, north)
    // A single point has no direction; its band runs north to south.
    return {
      ...point,
      normal: length === 0 ? { east: 0, north: 1 } : { east: -north / length, north: east / length },
    }
  })
}

/**
 * Boxes that together ask for the roads along a line, skipping what is already loaded.
 *
 * The planner walks the line in order. Wherever the buffered line is not yet covered, it grows
 * a box along the line while the box stays under `maxAreaM2` and the buffered line keeps filling
 * at least `minFill` of it. A straight diagonal line therefore becomes several small boxes, a
 * dense zig-zag in a small area becomes one box, and a stretch already covered (by an earlier
 * box of this plan, or by `isCovered`) is never asked for again.
 */
export function planLineRequests(
  line: Position[],
  {
    bufferMeters = DEFAULT_BUFFER_METERS,
    maxAreaM2 = DEFAULT_MAX_AREA_M2,
    minFill = DEFAULT_MIN_FILL,
    isCovered,
  }: PlanLineRequestsOptions = {},
): LineRequest[] {
  const samples = sampleLine(line)
  const planned: LineRequest[] = []

  const covered = (lon: number, lat: number) =>
    planned.some((bounds) => containsPoint(bounds, lon, lat)) || (isCovered?.(lon, lat) ?? false)

  /** The line here and both edges of its buffer, each of which has to be loaded. */
  const bandCovered = (sample: Sample) => {
    const offsetLon = (bufferMeters * sample.normal.east) / (METERS_PER_DEGREE_LAT * Math.cos((sample.lat * Math.PI) / 180))
    const offsetLat = (bufferMeters * sample.normal.north) / METERS_PER_DEGREE_LAT
    return [
      [sample.lon, sample.lat],
      [sample.lon + offsetLon, sample.lat + offsetLat],
      [sample.lon - offsetLon, sample.lat - offsetLat],
    ].every(([lon = 0, lat = 0]) => covered(lon, lat))
  }

  let start = 0
  while (start < samples.length) {
    const first = samples[start]
    if (!first || bandCovered(first)) {
      start += 1
      continue
    }

    let extent = toBounds(first)
    let end = start
    for (let index = start + 1; index < samples.length; index += 1) {
      const sample = samples[index]
      if (!sample) break
      const grown: MapBounds = {
        south: Math.min(extent.south, sample.lat),
        north: Math.max(extent.north, sample.lat),
        west: Math.min(extent.west, sample.lon),
        east: Math.max(extent.east, sample.lon),
      }
      const box = padBounds(grown, bufferMeters)
      const area = boundsAreaM2(box)
      if (area > maxAreaM2) break
      const bufferedLineM2 = (sample.distance - first.distance) * 2 * bufferMeters
      const fill = Math.min(1, bufferedLineM2 / area)
      if (area > FILL_CHECK_AREA_M2 && fill < minFill) break
      extent = grown
      end = index
    }

    planned.push(padBounds(extent, bufferMeters))
    start = end + 1
  }

  return planned
}
