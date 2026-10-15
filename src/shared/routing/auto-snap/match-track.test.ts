import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Position } from 'geojson'
import init from 'route-snapper'
import { beforeAll, describe, expect, it } from 'vitest'
import { maxDeviationMeters } from '@/shared/routing/auto-snap/line-deviation'
import { matchTrack } from '@/shared/routing/auto-snap/match-track'
import { haversineMeters } from '@/shared/routing/haversine'
import { getRouteEngine, type RouteEngine } from '@/shared/routing/route-engine'

/**
 * A 5×5 street grid at 52.5/13.4 with 0.001° between streets, densified like the app does
 * (see fixtures/). Node (row, column) is at [13.4 + column * 0.001, 52.5 + row * 0.001].
 */
const at = (row: number, column: number): Position => [13.4 + column * 0.001, 52.5 + row * 0.001]

/** Points every ~10 m along straight legs, wobbling a few meters like a GPS track. */
function track(...corners: Position[]): Position[] {
  const points: Position[] = []
  let step = 0
  for (let index = 1; index < corners.length; index += 1) {
    const [lon1 = 0, lat1 = 0] = corners[index - 1] ?? []
    const [lon2 = 0, lat2 = 0] = corners[index] ?? []
    const count = Math.ceil(haversineMeters(lat1, lon1, lat2, lon2) / 10)
    for (let i = 0; i < count; i += 1) {
      const t = i / count
      const wobble = Math.sin((step += 1)) * 0.00003
      points.push([lon1 + (lon2 - lon1) * t + wobble, lat1 + (lat2 - lat1) * t - wobble])
    }
  }
  points.push(corners.at(-1) ?? [0, 0])
  return points
}

let engine: RouteEngine

function inputFor(parts: Position[][], pinned = [] as Parameters<typeof matchTrack>[0]['pinned']) {
  const nodes = engine.snappableNodes()
  return {
    parts,
    pinned,
    nearestNode: (position: Position, maxMeters: number) => {
      let best: Position | null = null
      let bestMeters = maxMeters
      for (const node of nodes) {
        const meters = haversineMeters(
          position[1] ?? 0,
          position[0] ?? 0,
          node[1] ?? 0,
          node[0] ?? 0,
        )
        if (meters <= bestMeters) {
          best = node
          bestMeters = meters
        }
      }
      return best
    },
    route: (waypoints: Parameters<RouteEngine['route']>[0]) =>
      engine.route(waypoints)?.coordinates ?? null,
  }
}

beforeAll(async () => {
  const modules = path.resolve(import.meta.dirname, '../../../../node_modules')
  await init(readFileSync(path.join(modules, 'route-snapper/route_snapper_bg.wasm')))
  engine = await getRouteEngine(
    new Uint8Array(readFileSync(path.join(import.meta.dirname, 'fixtures/street-grid.graph.bin'))),
  )
})

describe('matchTrack', () => {
  it('snaps a noisy track along streets with only a few waypoints', () => {
    const line = track(at(0, 0), at(0, 4), at(2, 4))
    const waypoints = matchTrack(inputFor([line]))

    expect(waypoints.every((waypoint) => waypoint.snapped && !waypoint.pinned)).toBe(true)
    expect(waypoints.length).toBeLessThanOrEqual(4)
    const routed = engine.route(waypoints)?.coordinates ?? []
    expect(maxDeviationMeters(routed, line)).toBeLessThan(15)
  })

  it('follows the track freehand where it leaves the roads', () => {
    // Diagonally through the middle of a block: ~50 m from every street at its centre.
    const line = track(at(1, 1), at(2, 2), at(2, 3))
    const waypoints = matchTrack(inputFor([line]))

    expect(waypoints.some((waypoint) => !waypoint.snapped)).toBe(true)
    const routed = engine.route(waypoints)?.coordinates ?? []
    // Within the review threshold: where the track leaves the road, the route leaves at the
    // nearest road node.
    expect(maxDeviationMeters(routed, line)).toBeLessThan(20)
  })

  it('bridges the jump between two parts with a freehand point', () => {
    const waypoints = matchTrack(inputFor([track(at(0, 0), at(0, 1)), track(at(2, 3), at(2, 4))]))
    const free = waypoints.filter((waypoint) => !waypoint.snapped)
    expect(free).toHaveLength(1)
    expect(free[0]?.lat).toBeCloseTo(52.501, 4)
  })

  it('keeps the waypoints the user placed', () => {
    const line = track(at(0, 0), at(0, 4))
    // The user pulled the route one street north in the middle.
    const pin = { lon: at(1, 2)[0] ?? 0, lat: at(1, 2)[1] ?? 0, snapped: true, pinned: true }
    const waypoints = matchTrack(inputFor([line], [pin]))

    expect(waypoints).toContainEqual(pin)
    expect(waypoints.filter((waypoint) => waypoint.pinned)).toHaveLength(1)
  })
})

describe('matchTrack on straight off-road cuts', () => {
  it('follows a straight cut through a block instead of routing around it', () => {
    // Exactly straight (no GPS wobble), so simplifying leaves only the two road ends.
    const line: Position[] = [at(0, 0), at(0, 2), at(1, 2), at(2, 1)]
    const waypoints = matchTrack(inputFor([line]))

    expect(waypoints.some((waypoint) => !waypoint.snapped)).toBe(true)
    const routed = engine.route(waypoints)?.coordinates ?? []
    expect(maxDeviationMeters(routed, line)).toBeLessThan(20)
  })
})
