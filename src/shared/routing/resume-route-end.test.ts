import { describe, expect, it } from 'vitest'
import { pickRouteEndToResume, waypointsStartingFromEnd } from '@/shared/routing/resume-route-end'

const start = { lon: 13, lat: 52, snapped: true }
const end = { lon: 13.002, lat: 52, snapped: true }
const waypoints = [start, { lon: 13.001, lat: 52, snapped: true }, end]

describe('pickRouteEndToResume', () => {
  it('picks the start when the click is on the first waypoint', () => {
    expect(pickRouteEndToResume(waypoints, 13, 52, 20)).toBe('start')
  })

  it('picks the end when the click is on the last waypoint', () => {
    expect(pickRouteEndToResume(waypoints, 13.002, 52, 20)).toBe('end')
  })

  it('returns null when the click is on a mid waypoint', () => {
    expect(pickRouteEndToResume(waypoints, 13.001, 52, 5)).toBeNull()
  })

  it('picks the closer end when both are in range', () => {
    expect(pickRouteEndToResume([start, end], 13.0002, 52, 200)).toBe('start')
  })
})

describe('waypointsStartingFromEnd', () => {
  it('keeps order when resuming from the end', () => {
    expect(waypointsStartingFromEnd(waypoints, 'end')).toEqual(waypoints)
  })

  it('reverses order when resuming from the start', () => {
    expect(waypointsStartingFromEnd(waypoints, 'start')).toEqual(waypoints.slice().reverse())
  })
})
