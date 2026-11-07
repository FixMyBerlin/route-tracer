import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { findTrackMismatches } from '@/shared/track-source/compare-route-to-track'
import { maxDeviationMeters } from '@/shared/routing/auto-snap/line-deviation'
import { matchTrack } from '@/shared/routing/auto-snap/match-track'
import {
  buildSyntheticGraph,
  local,
  polylineMeters,
  straight,
  withGpsNoise,
  type SyntheticRoad,
} from '@/shared/routing/auto-snap/synthetic-network'
import { createPointIndex } from '@/shared/routing/auto-snap/point-index'
import { getRouteEngine, type RouteEngine } from '@/shared/routing/route-engine'

type Case = {
  name: string
  roads: SyntheticRoad[]
  /** Noise-free path the track was driven on. */
  truth: Position[]
  /** Noisy GPS track handed to the matcher. */
  track: Position[]
}

function arcMeters(centerEast: number, centerNorth: number, radius: number, fromDeg: number, toDeg: number, stepDeg = 5) {
  const points: Position[] = []
  const steps = Math.ceil(Math.abs(toDeg - fromDeg) / stepDeg)
  for (let step = 0; step <= steps; step += 1) {
    const angle = ((fromDeg + ((toDeg - fromDeg) * step) / steps) * Math.PI) / 180
    points.push(local(centerEast + radius * Math.cos(angle), centerNorth + radius * Math.sin(angle)))
  }
  return points
}

const cases = (): Case[] => {
  // 1. Cycle track 8 m north of a main road, joined at both ends.
  const cycleTruth = polylineMeters([
    [0, 8],
    [600, 8],
  ])
  const cycleBeside: Case = {
    name: 'cycle track 8 m beside a main road',
    roads: [
      straight([0, 0], [600, 0]),
      { ...straight([0, 8], [600, 8]), highway: 'cycleway' },
      straight([0, 0], [0, 8]),
      straight([600, 0], [600, 8]),
    ],
    truth: cycleTruth,
    track: withGpsNoise(cycleTruth, 6, 1),
  }

  // 2. Diagonal across a dense grid (40 m blocks): every streets-only route is a staircase.
  const diagonalTruth = polylineMeters([
    [40, 0],
    [240, 160],
  ])
  const grid: SyntheticRoad[] = []
  for (let line = 0; line <= 400; line += 40) {
    grid.push(straight([line, 0], [line, 400]))
    grid.push(straight([0, line], [400, line]))
  }
  const gridDiagonal: Case = {
    name: 'diagonal across a 40 m grid',
    roads: grid,
    truth: diagonalTruth,
    track: withGpsNoise(diagonalTruth, 6, 2),
  }

  // 3. Out and back on one street.
  const outBackTruth = polylineMeters([
    [0, 0],
    [300, 0],
    [0, 0],
  ])
  const outAndBack: Case = {
    name: 'out and back on one street',
    roads: [straight([0, 0], [300, 0])],
    truth: outBackTruth,
    track: withGpsNoise(outBackTruth, 6, 3),
  }

  // 4. Roundabout (radius 40 m): enter from the south, go round counter-clockwise, leave west.
  const ring: Position[] = arcMeters(0, 0, 40, -90, 270, 22.5)
  const roundaboutTruth = [
    ...polylineMeters([
      [0, -200],
      [0, -40],
    ]),
    ...arcMeters(0, 0, 40, -90, 180, 5).slice(1),
    ...polylineMeters([
      [-40, 0],
      [-200, 0],
    ]).slice(1),
  ]
  const roundabout: Case = {
    name: 'roundabout, leave the long way round',
    roads: [
      { points: ring },
      straight([0, -200], [0, -40]),
      straight([40, 0], [200, 0]),
      straight([0, 40], [0, 200]),
      straight([-40, 0], [-200, 0]),
    ],
    truth: roundaboutTruth,
    track: withGpsNoise(roundaboutTruth, 6, 4),
  }

  return [cycleBeside, gridDiagonal, outAndBack, roundabout]
}

function createEvaluator(engine: RouteEngine) {
  const nodes = createPointIndex(engine.snappableNodes())
  return (track: Position[]) =>
    matchTrack({
      parts: [track],
      nearestNode: (position, maxMeters) => nodes.nearest(position, maxMeters)?.position ?? null,
      route: (list) => engine.route(list)?.coordinates ?? null,
    })
}

describe('hard cases report', () => {
  it('reports quality', async () => {
    const rows: string[] = []
    for (const testCase of cases()) {
      const bytes = await buildSyntheticGraph(testCase.roads)
      const engine = await getRouteEngine(bytes)
      const waypoints = createEvaluator(engine)(testCase.track)
      const routed = engine.route(waypoints)?.coordinates ?? []
      const review = findTrackMismatches(testCase.track, routed).length
      const freehand = waypoints.filter((waypoint) => !waypoint.snapped).length
      rows.push(
        [
          testCase.name.padEnd(42),
          'dev-track',
          maxDeviationMeters(routed, testCase.track).toFixed(1).padStart(6),
          'dev-truth',
          maxDeviationMeters(routed, testCase.truth).toFixed(1).padStart(6),
          'review',
          String(review + freehand).padStart(3),
          'wps',
          String(waypoints.length).padStart(3),
        ].join(' '),
      )
    }
    console.log(rows.join('\n'))
    expect(rows.length).toBe(4)
  }, 120_000)
})
