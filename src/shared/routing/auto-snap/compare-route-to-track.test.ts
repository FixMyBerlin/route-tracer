import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { findTrackMismatches } from '@/shared/routing/auto-snap/compare-route-to-track'

const ORIGIN_LON = 13.4
const ORIGIN_LAT = 52.5

/** Position `east` and `north` metres from the test origin. */
function offset(east: number, north: number): Position {
  const cosLat = Math.cos((ORIGIN_LAT * Math.PI) / 180)
  return [ORIGIN_LON + east / (111_320 * cosLat), ORIGIN_LAT + north / 110_540]
}

/** Straight east-west track of `lengthMeters`, one vertex every 10 m. */
function straightTrack(lengthMeters: number): Position[] {
  return Array.from({ length: lengthMeters / 10 + 1 }, (_, i) => offset(i * 10, 0))
}

describe('findTrackMismatches', () => {
  it('finds nothing for identical route and track', () => {
    const track = straightTrack(1000)
    expect(findTrackMismatches(track, [...track])).toEqual([])
  })

  it('flags a rectangular detour of about 60 m for 200 m as one mismatch', () => {
    const track = straightTrack(1000)
    const route: Position[] = [
      offset(0, 0),
      offset(400, 0),
      offset(400, 60),
      offset(600, 60),
      offset(600, 0),
      offset(1000, 0),
    ]

    const result = findTrackMismatches(track, route)
    expect(result).toHaveLength(1)
    const [mismatch] = result
    expect(mismatch?.fromMeters ?? Number.NaN).toBeGreaterThan(380)
    expect(mismatch?.fromMeters ?? Number.NaN).toBeLessThan(420)
    expect(mismatch?.toMeters ?? Number.NaN).toBeGreaterThan(580)
    expect(mismatch?.toMeters ?? Number.NaN).toBeLessThan(620)
    expect(mismatch?.maxDistanceMeters ?? Number.NaN).toBeGreaterThan(55)
    expect(mismatch?.maxDistanceMeters ?? Number.NaN).toBeLessThan(65)
    expect(mismatch?.id).toBe(`m-${Math.floor((mismatch?.fromMeters ?? 0) / 25) * 25}`)
    expect(mismatch?.coordinates.length ?? 0).toBeGreaterThan(2)
  })

  it('flags a track loop that the route shortcuts over', () => {
    const track: Position[] = [
      offset(0, 0),
      offset(300, 0),
      offset(300, 200),
      offset(600, 200),
      offset(600, 0),
      offset(900, 0),
    ]
    const route: Position[] = [offset(0, 0), offset(900, 0)]

    const result = findTrackMismatches(track, route)
    expect(result).toHaveLength(1)
    const [mismatch] = result
    expect(mismatch?.fromMeters ?? Number.NaN).toBeGreaterThan(280)
    expect(mismatch?.fromMeters ?? Number.NaN).toBeLessThan(340)
    expect(mismatch?.toMeters ?? Number.NaN).toBeGreaterThan(960)
    expect(mismatch?.toMeters ?? Number.NaN).toBeLessThan(1020)
    expect(mismatch?.maxDistanceMeters ?? Number.NaN).toBeGreaterThan(190)
    expect(mismatch?.maxDistanceMeters ?? Number.NaN).toBeLessThan(210)
  })

  it('merges two detours 20 m apart, but not when the merge gap is zero', () => {
    const track = straightTrack(1000)
    const route: Position[] = [
      offset(0, 0),
      offset(300, 0),
      offset(300, 60),
      offset(400, 60),
      offset(400, 0),
      offset(420, 0),
      offset(420, 60),
      offset(520, 60),
      offset(520, 0),
      offset(1000, 0),
    ]

    const merged = findTrackMismatches(track, route)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.fromMeters ?? Number.NaN).toBeLessThan(310)
    expect(merged[0]?.toMeters ?? Number.NaN).toBeGreaterThan(510)

    const separate = findTrackMismatches(track, route, { mergeGapMeters: 0 })
    expect(separate).toHaveLength(2)
  })

  it('handles a 30 km track and a 6000-vertex route quickly', () => {
    // A wavy 30 km track, and a route on the same curve 3 m to the north.
    const wave = (east: number) => 200 * Math.sin(east / 3000)
    const track: Position[] = Array.from({ length: 3001 }, (_, i) => offset(i * 10, wave(i * 10)))
    const route: Position[] = Array.from({ length: 6001 }, (_, i) => offset(i * 5, wave(i * 5) + 3))

    const started = performance.now()
    const result = findTrackMismatches(track, route)
    const elapsed = performance.now() - started

    expect(result).toEqual([])
    expect(elapsed).toBeLessThan(500)
  })
})
