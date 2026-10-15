import type { Position } from 'geojson'
import { locateAlongLine } from '@/shared/routing/auto-snap/line-deviation'
import { minimizeWaypoints } from '@/shared/routing/auto-snap/minimize-waypoints'
import { sampleTrack } from '@/shared/routing/auto-snap/sample-track'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'
import { haversineMeters } from '@/shared/routing/haversine'
import type { EngineWaypoint } from '@/shared/routing/route-engine'
import { simplifyTrackIndices, simplifyTrackMeters } from '@/shared/track-source/simplify-track'

/** Removes GPS jitter before sampling; well below the width of a street. */
const TRACK_SIMPLIFY_METERS = 3
/**
 * Track vertices are checked for a road this often. A simplified straight stretch through a
 * park has only its two ends left, and both of those can be on a road.
 */
const ROAD_CHECK_STEP_METERS = 10
/** Distance between candidate waypoints along the track. */
const SAMPLE_SPACING_METERS = 150
/**
 * A track point further than this from every road node is off-road. GPS is rarely off by more;
 * a larger reach would also pull the route that far away from where the track leaves the road.
 */
const ROAD_REACH_METERS = 15
/**
 * Snapped auto waypoints this close (along the track) to one the user placed give way to it. A
 * whole sample spacing: the user usually dragged that very sample, and bringing it back would
 * pull the route straight back to where they moved it from.
 */
const PINNED_CLEARANCE_METERS = SAMPLE_SPACING_METERS

export type MatchTrackInput = {
  /** The track's continuous parts in order; the jumps between them are bridged freehand. */
  parts: Position[][]
  /** Nearest snappable graph node within `maxMeters`, or null. */
  nearestNode: (position: Position, maxMeters: number) => Position | null
  /** Route through the waypoints, as route-snapper would draw it. */
  route: (waypoints: EngineWaypoint[]) => Position[] | null
  /** Waypoints the user placed or moved on a previous version of the route; they are kept. */
  pinned?: FlaggedWaypoint[]
}

type Candidate = FlaggedWaypoint & {
  along: number
  /** Where the track leaves or joins the roads; the freehand stretch is attached here. */
  anchor?: boolean
}

function cumulativeMeters(line: Position[]) {
  const along = [0]
  for (let index = 1; index < line.length; index += 1) {
    const [lon1 = 0, lat1 = 0] = line[index - 1] ?? []
    const [lon2 = 0, lat2 = 0] = line[index] ?? []
    along.push((along[index - 1] ?? 0) + haversineMeters(lat1, lon1, lat2, lon2))
  }
  return along
}

/** Extra vertices so no two are more than `stepMeters` apart. */
function densify(line: Position[], stepMeters: number) {
  const dense: Position[] = []
  for (const [index, to] of line.entries()) {
    const from = line[index - 1]
    if (from) {
      const meters = haversineMeters(from[1] ?? 0, from[0] ?? 0, to[1] ?? 0, to[0] ?? 0)
      const steps = Math.ceil(meters / stepMeters)
      for (let step = 1; step < steps; step += 1) {
        const t = step / steps
        dense.push([
          (from[0] ?? 0) + ((to[0] ?? 0) - (from[0] ?? 0)) * t,
          (from[1] ?? 0) + ((to[1] ?? 0) - (from[1] ?? 0)) * t,
        ])
      }
    }
    dense.push(to)
  }
  return dense
}

/** Thin out runs of freehand waypoints back to the track's shape. */
function simplifyFreehandRuns(candidates: Candidate[]) {
  const result: Candidate[] = []
  let run: Candidate[] = []
  const flush = () => {
    const kept = simplifyTrackIndices(
      run.map((candidate) => [candidate.lon, candidate.lat]),
      TRACK_SIMPLIFY_METERS,
    )
    for (const index of kept) {
      const candidate = run[index]
      if (candidate) result.push(candidate)
    }
    run = []
  }
  for (const candidate of candidates) {
    if (!candidate.snapped && !candidate.pinned) {
      run.push(candidate)
      continue
    }
    flush()
    result.push(candidate)
  }
  flush()
  return result
}

function auto(position: Position, snapped: boolean, along: number): Candidate {
  return { lon: position[0] ?? 0, lat: position[1] ?? 0, snapped, pinned: false, along }
}

/**
 * Candidates for one continuous part: a waypoint about every 150 m (and at turns), snapped to
 * the nearest road node. Where the track is out of reach of every road, the route follows the
 * track itself: each of those vertices becomes a freehand waypoint, and the vertices on either
 * side snap so the road stretches end right there.
 */
function partCandidates(
  simplifiedPart: Position[],
  offsetMeters: number,
  nearestNode: MatchTrackInput['nearestNode'],
) {
  const part = densify(simplifiedPart, ROAD_CHECK_STEP_METERS)
  const along = cumulativeMeters(part)
  const sampled = new Set(
    sampleTrack(part, { spacingMeters: SAMPLE_SPACING_METERS }).map((sample) => sample.index),
  )
  const nodes = part.map((vertex) => nearestNode(vertex, ROAD_REACH_METERS))
  const candidates: Candidate[] = []

  for (const [index, vertex] of part.entries()) {
    const at = offsetMeters + (along[index] ?? 0)
    const node = nodes[index]
    if (!node) {
      candidates.push(auto(vertex, false, at))
      continue
    }
    const besideOffRoad = nodes[index - 1] === null || nodes[index + 1] === null
    if (besideOffRoad) candidates.push({ ...auto(node, true, at), anchor: true })
    else if (sampled.has(index)) candidates.push(auto(node, true, at))
  }

  return { candidates: simplifyFreehandRuns(candidates), lengthMeters: along.at(-1) ?? 0 }
}

function samePosition(a: FlaggedWaypoint, b: FlaggedWaypoint) {
  return a.lon === b.lon && a.lat === b.lat
}

/**
 * Turn an uploaded track into route waypoints: snapped where a road is near, freehand along
 * the track where none is, and straight across the jumps between parts. Then drop every auto
 * waypoint the route does not need, so the result is easy to adjust by hand.
 */
export function matchTrack({ parts, nearestNode, route, pinned = [] }: MatchTrackInput) {
  const simplified = parts
    .map((part) => simplifyTrackMeters(part, TRACK_SIMPLIFY_METERS))
    .filter((part) => part.length >= 2)

  let candidates: Candidate[] = []
  let offset = 0
  for (const [partIndex, part] of simplified.entries()) {
    const previousEnd = simplified[partIndex - 1]?.at(-1)
    const start = part[0]
    if (previousEnd && start) {
      // A freehand point in the middle of the jump keeps both of its sides straight.
      const middle: Position = [
        ((previousEnd[0] ?? 0) + (start[0] ?? 0)) / 2,
        ((previousEnd[1] ?? 0) + (start[1] ?? 0)) / 2,
      ]
      const jump = haversineMeters(
        previousEnd[1] ?? 0,
        previousEnd[0] ?? 0,
        start[1] ?? 0,
        start[0] ?? 0,
      )
      candidates.push(auto(middle, false, offset + jump / 2))
      offset += jump
    }
    const result = partCandidates(part, offset, nearestNode)
    candidates.push(...result.candidates)
    offset += result.lengthMeters
  }

  if (pinned.length > 0) {
    const line = simplified.flat()
    let cursor = 0
    const placed = pinned.map((waypoint) => {
      cursor = locateAlongLine(line, [waypoint.lon, waypoint.lat], cursor).alongMeters
      return { ...waypoint, along: cursor }
    })
    candidates = [
      ...candidates.filter(
        (candidate) =>
          // Freehand points trace the track where no road is; they and their ends stay.
          !candidate.snapped ||
          candidate.anchor ||
          placed.every((pin) => Math.abs(pin.along - candidate.along) > PINNED_CLEARANCE_METERS),
      ),
      ...placed,
    ].sort((a, b) => a.along - b.along)
  }

  // Two samples on the same road node would make an empty stretch.
  const waypoints: FlaggedWaypoint[] = []
  for (const { along: _along, anchor: _anchor, ...waypoint } of candidates) {
    const previous = waypoints.at(-1)
    if (previous && samePosition(previous, waypoint)) {
      previous.pinned ||= waypoint.pinned
      continue
    }
    waypoints.push(waypoint)
  }

  // Graph islands (a path not connected to the rest) cannot be routed into; go straight there.
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1]
    const to = waypoints[index]
    if (!from?.snapped || !to?.snapped || to.pinned) continue
    if (!route([from, to])) to.snapped = false
  }

  return minimizeWaypoints(waypoints, {
    isFixed: (waypoint) => waypoint.pinned || !waypoint.snapped,
    route,
  })
}
