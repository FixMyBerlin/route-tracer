import type { Position } from 'geojson'
import { locateAlongLine, sliceLineByDistance } from '@/shared/routing/auto-snap/line-deviation'
import { pathLengthMeters } from '@/shared/routing/haversine'

/** Along-line distances of the section boundaries: start, each interior waypoint, end. */
function boundariesMeters(line: Position[], waypoints: Position[]): number[] {
  const total = pathLengthMeters(line)
  const boundaries = [0]
  let cursor = 0
  for (let index = 1; index < waypoints.length - 1; index += 1) {
    const waypoint = waypoints[index]
    if (!waypoint) continue
    cursor = locateAlongLine(line, waypoint, cursor).alongMeters
    boundaries.push(cursor)
  }
  boundaries.push(total)
  return boundaries
}

/**
 * Splits a route line into `waypoints.length - 1` sections between consecutive waypoints. Each
 * waypoint is located on the line after the previous one, so out-and-back routes that visit a
 * waypoint twice split in the right place. The first section starts at the line start and the
 * last one ends at the line end.
 */
export function splitLineAtWaypoints(line: Position[], waypoints: Position[]): Position[][] {
  if (waypoints.length < 2) return []
  const boundaries = boundariesMeters(line, waypoints)
  const sections: Position[][] = []
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    sections.push(sliceLineByDistance(line, boundaries[index] ?? 0, boundaries[index + 1] ?? 0))
  }
  return sections
}

/** Rounded length in meters of each section from `splitLineAtWaypoints`. */
export function sectionLengthsMeters(line: Position[], waypoints: Position[]): number[] {
  return splitLineAtWaypoints(line, waypoints).map((section) =>
    Math.round(pathLengthMeters(section)),
  )
}
