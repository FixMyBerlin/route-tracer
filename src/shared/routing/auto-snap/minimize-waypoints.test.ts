import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { minimizeWaypoints } from '@/shared/routing/auto-snap/minimize-waypoints'

type Wp = { lon: number; lat: number; fixed?: boolean }

/** Fake router: a straight polyline through the waypoints in order. */
const straightRoute = (waypoints: Wp[]): Position[] => waypoints.map((w) => [w.lon, w.lat])
const isFixed = (waypoint: Wp) => waypoint.fixed === true

const start: Wp = { lon: 13, lat: 52 }
const middle: Wp = { lon: 13.01, lat: 52 }
const middle2: Wp = { lon: 13.02, lat: 52 }
const end: Wp = { lon: 13.03, lat: 52 }
const corner: Wp = { lon: 13.01, lat: 52 }
const turnEnd: Wp = { lon: 13.01, lat: 52.01 }

describe('minimizeWaypoints', () => {
  it('drops a waypoint in the middle of a straight route', () => {
    const kept = minimizeWaypoints([start, middle, end], { isFixed, route: straightRoute })
    expect(kept).toHaveLength(2)
    expect(kept[0]).toBe(start)
    expect(kept[1]).toBe(end)
  })

  it('drops a run of collinear waypoints', () => {
    const kept = minimizeWaypoints([start, middle, middle2, end], {
      isFixed,
      route: straightRoute,
    })
    expect(kept).toEqual([start, end])
  })

  it('keeps a waypoint at a corner', () => {
    const kept = minimizeWaypoints([start, corner, turnEnd], { isFixed, route: straightRoute })
    expect(kept).toHaveLength(3)
    expect(kept[1]).toBe(corner)
  })

  it('keeps fixed waypoints even when they are collinear', () => {
    const pinned: Wp = { ...middle, fixed: true }
    const kept = minimizeWaypoints([start, pinned, end], { isFixed, route: straightRoute })
    expect(kept).toEqual([start, pinned, end])
  })

  it('always keeps the first and last waypoint', () => {
    const kept = minimizeWaypoints([start, end], { isFixed: () => false, route: straightRoute })
    expect(kept).toEqual([start, end])
  })

  it('keeps a candidate when a route is missing', () => {
    const noRoute = (waypoints: Wp[]) => (waypoints.length === 2 ? null : straightRoute(waypoints))
    const kept = minimizeWaypoints([start, middle, end], { isFixed, route: noRoute })
    expect(kept).toEqual([start, middle, end])
  })

  it('uses a custom sameRoute when given', () => {
    const kept = minimizeWaypoints([start, corner, turnEnd], {
      isFixed,
      route: straightRoute,
      sameRoute: () => true,
    })
    expect(kept).toEqual([start, turnEnd])
  })
})
