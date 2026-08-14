import { describe, expect, it } from 'vitest'
import { mergeAdjacentWaypoints } from '@/shared/routing/merge-route-waypoints'

/** ~7 m apart at this latitude, so 10 m merges them and 5 m does not. */
const a = { lon: 13, lat: 52, snapped: true }
const b = { lon: 13.0001, lat: 52, snapped: true }
const far = { lon: 13.002, lat: 52, snapped: true }
const freeOnA = { lon: 13, lat: 52, snapped: false }

describe('mergeAdjacentWaypoints', () => {
  it('leaves points that are apart alone', () => {
    expect(mergeAdjacentWaypoints([a, far], 10)).toEqual([a, far])
  })

  it('merges a point dropped on its neighbour', () => {
    expect(mergeAdjacentWaypoints([a, b, far], 10)).toEqual([a, far])
  })

  it('keeps points that are close but not on top of each other', () => {
    expect(mergeAdjacentWaypoints([a, b, far], 5)).toEqual([a, b, far])
  })

  it('keeps the snapped point when a freehand one lands on it', () => {
    expect(mergeAdjacentWaypoints([freeOnA, b, far], 10)).toEqual([b, far])
    expect(mergeAdjacentWaypoints([b, freeOnA, far], 10)).toEqual([b, far])
  })

  it('keeps a point that meets a non-neighbour, so a loop survives', () => {
    expect(mergeAdjacentWaypoints([a, far, b], 10)).toEqual([a, far, b])
  })

  it('collapses a run of points dropped on the same spot', () => {
    expect(mergeAdjacentWaypoints([a, b, a, far], 10)).toEqual([a, far])
  })
})
