import { describe, expect, it } from 'vitest'
import {
  insertIndexAlongSegments,
  insertWaypointAt,
  isNearExistingWaypoint,
} from '@/shared/routing/insert-route-waypoint'

describe('insertIndexAlongSegments', () => {
  const segments = [
    [
      [13, 52],
      [13.001, 52],
    ],
    [
      [13.001, 52],
      [13.002, 52],
    ],
  ]

  it('inserts on the first segment', () => {
    const target = insertIndexAlongSegments(segments, 13.0005, 52)
    expect(target?.insertIndex).toBe(1)
    expect(target?.segmentIndex).toBe(0)
    expect(target?.lon).toBeCloseTo(13.0005, 5)
  })

  it('inserts on the second segment', () => {
    const target = insertIndexAlongSegments(segments, 13.0015, 52)
    expect(target?.insertIndex).toBe(2)
    expect(target?.segmentIndex).toBe(1)
  })

  it('returns null when the click is off the route', () => {
    expect(insertIndexAlongSegments(segments, 13.0005, 52.01)).toBeNull()
  })
})

describe('insertWaypointAt', () => {
  it('splits the waypoint list at the given index', () => {
    const waypoints = [
      { lon: 13, lat: 52, snapped: true },
      { lon: 13.002, lat: 52, snapped: true },
    ]
    expect(insertWaypointAt(waypoints, 1, { lon: 13.001, lat: 52, snapped: false })).toEqual([
      { lon: 13, lat: 52, snapped: true },
      { lon: 13.001, lat: 52, snapped: false },
      { lon: 13.002, lat: 52, snapped: true },
    ])
  })
})

describe('isNearExistingWaypoint', () => {
  it('detects a click on an existing waypoint', () => {
    expect(isNearExistingWaypoint([{ lon: 13, lat: 52, snapped: true }], 13, 52)).toBe(true)
    expect(isNearExistingWaypoint([{ lon: 13, lat: 52, snapped: true }], 13.1, 52)).toBe(false)
  })
})
