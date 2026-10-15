import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import { sampleTrack } from '@/shared/routing/auto-snap/sample-track'

const LAT = 52
const METERS_PER_DEG_LON = 111_320 * Math.cos((LAT * Math.PI) / 180)
const METERS_PER_DEG_LAT = 110_540

/** Vertices every `stepMeters` due east of 13,52. */
function eastLine(count: number, stepMeters: number): Position[] {
  return Array.from({ length: count }, (_, index) => [
    13 + (index * stepMeters) / METERS_PER_DEG_LON,
    LAT,
  ])
}

/** 50 steps of 10 m east, then 50 steps of 10 m north: a right-angle corner at index 50. */
function lShape(): Position[] {
  const east = eastLine(51, 10)
  const cornerLon = 13 + (50 * 10) / METERS_PER_DEG_LON
  const north = Array.from({ length: 50 }, (_, index) => [
    cornerLon,
    LAT + ((index + 1) * 10) / METERS_PER_DEG_LAT,
  ])
  return [...east, ...north]
}

describe('sampleTrack', () => {
  it('samples a straight 1 km line every ~150 m, plus both ends', () => {
    const samples = sampleTrack(eastLine(101, 10))
    expect(samples).toHaveLength(8)
    expect(samples[0]?.index).toBe(0)
    expect(samples.at(-1)?.index).toBe(100)
  })

  it('returns sorted, unique indices', () => {
    const indices = sampleTrack(eastLine(101, 10)).map((sample) => sample.index)
    expect(indices).toEqual([...new Set(indices)].sort((a, b) => a - b))
  })

  it('takes the vertex where an L-shaped track turns', () => {
    const indices = sampleTrack(lShape()).map((sample) => sample.index)
    expect(indices).toContain(50)
    expect(indices).not.toContain(25)
    expect(indices.at(-1)).toBe(100)
  })

  it('replaces the previous sample when the last vertex is too close to it', () => {
    const indices = sampleTrack(eastLine(32, 10)).map((sample) => sample.index)
    expect(indices).toHaveLength(3)
    expect(indices).not.toContain(30)
    expect(indices.at(-1)).toBe(31)
  })

  it('keeps the first vertex on a track shorter than the minimum gap', () => {
    const indices = sampleTrack(eastLine(2, 10)).map((sample) => sample.index)
    expect(indices).toEqual([0, 1])
  })

  it('handles tracks with fewer than two vertices', () => {
    expect(sampleTrack([])).toEqual([])
    expect(sampleTrack([[13, 52]])).toEqual([{ index: 0, position: [13, 52] }])
  })
})
