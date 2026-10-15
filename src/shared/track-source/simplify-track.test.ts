import { describe, expect, it } from 'vitest'
import { simplifyTrackIndices, simplifyTrackMeters } from '@/shared/track-source/simplify-track'

describe('simplifyTrackMeters', () => {
  it('removes a colinear midpoint and keeps the endpoints', () => {
    const line = [
      [13, 52],
      [13.0005, 52],
      [13.001, 52],
    ]

    expect(simplifyTrackMeters(line, 1)).toEqual([
      [13, 52],
      [13.001, 52],
    ])
    expect(simplifyTrackIndices(line, 1)).toEqual([0, 2])
  })

  it('keeps a 20 m bump when the tolerance is 3 m', () => {
    // 0.00018 degrees of latitude is about 20 m.
    const bump = [
      [13, 52],
      [13.001, 52.00018],
      [13.002, 52],
    ]

    expect(simplifyTrackMeters(bump, 3)).toEqual(bump)
    expect(simplifyTrackIndices(bump, 3)).toEqual([0, 1, 2])
  })

  it('removes the same bump when the tolerance is larger than it', () => {
    const bump = [
      [13, 52],
      [13.001, 52.00018],
      [13.002, 52],
    ]

    expect(simplifyTrackIndices(bump, 30)).toEqual([0, 2])
  })

  it('keeps the first and last point even for a closed loop', () => {
    const loop = [
      [13, 52],
      [13.001, 52.001],
      [13.002, 52],
      [13, 52],
    ]

    const indices = simplifyTrackIndices(loop, 1000)
    expect(indices[0]).toBe(0)
    expect(indices.at(-1)).toBe(3)
  })

  it('returns short tracks unchanged', () => {
    expect(simplifyTrackMeters([], 1)).toEqual([])
    expect(simplifyTrackMeters([[1, 1]], 1)).toEqual([[1, 1]])
    expect(
      simplifyTrackMeters(
        [
          [1, 1],
          [2, 2],
        ],
        1,
      ),
    ).toEqual([
      [1, 1],
      [2, 2],
    ])
  })

  it('handles a long track without recursion limits', () => {
    // Half a circle of 50 000 points: balanced splits, so this stays fast.
    const count = 50_000
    const arc = Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * index) / (count - 1)
      return [13 + 0.05 * Math.cos(angle), 52 + 0.05 * Math.sin(angle)]
    })

    const indices = simplifyTrackIndices(arc, 1)
    expect(indices[0]).toBe(0)
    expect(indices.at(-1)).toBe(count - 1)
    expect(indices.length).toBeLessThan(count)
    expect(indices.length).toBeGreaterThan(2)
  })
})
