import { describe, expect, it } from 'vitest'
import { carryPinnedFlags } from '@/shared/routing/auto-snap/carry-pinned-flags'
import type { FlaggedWaypoint } from '@/shared/routing/flagged-waypoint'

const METERS_PER_DEG_LAT = 110_540

const previous: FlaggedWaypoint[] = [
  { lon: 13, lat: 52, snapped: true, pinned: false },
  { lon: 13.01, lat: 52, snapped: false, pinned: true },
  { lon: 13.02, lat: 52, snapped: true, pinned: false },
]

const plain = (waypoints: FlaggedWaypoint[]) =>
  waypoints.map(({ lon, lat, snapped }) => ({ lon, lat, snapped }))

describe('carryPinnedFlags', () => {
  it('keeps flags for unchanged waypoints', () => {
    const result = carryPinnedFlags(previous, plain(previous))
    expect(result.map((waypoint) => waypoint.pinned)).toEqual([false, true, false])
  })

  it('marks a moved waypoint as pinned', () => {
    const next = plain(previous)
    next[0] = { lon: 13, lat: 52 + 5 / METERS_PER_DEG_LAT, snapped: true }
    const result = carryPinnedFlags(previous, next)
    expect(result.map((waypoint) => waypoint.pinned)).toEqual([true, true, false])
  })

  it('marks an inserted waypoint as pinned', () => {
    const next = [
      ...plain(previous).slice(0, 1),
      { lon: 13.005, lat: 52, snapped: true },
      ...plain(previous).slice(1),
    ]
    const result = carryPinnedFlags(previous, next)
    expect(result.map((waypoint) => waypoint.pinned)).toEqual([false, true, true, false])
  })

  it('treats a changed snapped flag as a new waypoint', () => {
    const next = plain(previous)
    next[0] = { lon: 13, lat: 52, snapped: false }
    const result = carryPinnedFlags(previous, next)
    expect(result[0]?.pinned).toBe(true)
  })

  it('matches out of order, searching the rest after the last match', () => {
    const swapped = [
      { lon: 13.01, lat: 52, snapped: false },
      { lon: 13, lat: 52, snapped: true },
    ]
    const result = carryPinnedFlags(previous, swapped)
    expect(result.map((waypoint) => waypoint.pinned)).toEqual([true, false])
  })

  it('returns the new positions with the carried flag', () => {
    const result = carryPinnedFlags(previous, plain(previous))
    expect(result[1]).toEqual({ lon: 13.01, lat: 52, snapped: false, pinned: true })
  })
})
