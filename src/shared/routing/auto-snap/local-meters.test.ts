import { describe, expect, it } from 'vitest'
import {
  createLocalProjection,
  pointToPolylineMeters,
  pointToSegmentMeters,
} from '@/shared/routing/auto-snap/local-meters'

const eastMeters = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180)

describe('createLocalProjection', () => {
  it('puts the origin at zero and scales north and east to meters', () => {
    const project = createLocalProjection([13, 52])
    expect(project.toXY([13, 52])).toEqual([0, 0])
    expect(project.toXY([13, 52.001])[1]).toBeCloseTo(110.54, 6)
    expect(project.toXY([13.001, 52])[0]).toBeCloseTo(eastMeters(52) / 1000, 6)
  })
})

describe('pointToSegmentMeters', () => {
  const from = [13, 52] as const
  const to = [13.02, 52] as const

  it('measures the perpendicular distance and the position along the segment', () => {
    const offset = 10 / 110_540
    const hit = pointToSegmentMeters([13.01, 52 + offset], [...from], [...to])
    expect(hit.distance).toBeCloseTo(10, 6)
    expect(hit.t).toBeCloseTo(0.5, 6)
  })

  it('clamps to the end of the segment', () => {
    const hit = pointToSegmentMeters([13.04, 52], [...from], [...to])
    expect(hit.t).toBe(1)
    expect(hit.distance).toBeCloseTo(0.02 * eastMeters(52), 0)
  })
})

describe('pointToPolylineMeters', () => {
  const line = [
    [13, 52],
    [13.01, 52],
    [13.01, 52.01],
  ]

  it('finds the segment nearest to the point', () => {
    const hit = pointToPolylineMeters([13.0101, 52.005], line)
    expect(hit.segmentIndex).toBe(1)
    expect(hit.t).toBeCloseTo(0.5, 2)
    expect(hit.distance).toBeCloseTo(0.0001 * eastMeters(52), 0)
  })

  it('reports an infinite distance for an empty line', () => {
    expect(pointToPolylineMeters([13, 52], []).distance).toBe(Number.POSITIVE_INFINITY)
  })
})
