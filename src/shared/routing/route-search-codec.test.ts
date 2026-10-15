import { compressToEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import { decodeRouteSearch, encodeRouteSearch } from '@/shared/routing/route-search-codec'

describe('route search codec', () => {
  it('round-trips waypoints with their flags and section lengths', () => {
    const state = {
      waypoints: [
        { lon: 13.4, lat: 52.5, snapped: true, pinned: false },
        { lon: 13.401234, lat: 52.501234, snapped: false, pinned: true },
        { lon: 13.402, lat: 52.5, snapped: true, pinned: true },
      ],
      sectionLengths: [150, 210],
    }
    expect(decodeRouteSearch(encodeRouteSearch(state))).toEqual(state)
  })

  it('drops section lengths that do not fit the waypoints', () => {
    const encoded = compressToEncodedURIComponent(
      JSON.stringify({
        v: 2,
        w: [
          [13.4, 52.5, 1],
          [13.41, 52.5, 1],
        ],
        l: [1, 2, 3],
      }),
    )
    expect(decodeRouteSearch(encoded)?.sectionLengths).toBeUndefined()
  })

  it('opens links that still hold the drawn stretches (v1)', () => {
    const v1 = compressToEncodedURIComponent(
      JSON.stringify({
        s: [
          {
            k: 's',
            c: [
              [13.4, 52.5],
              [13.401, 52.5],
              [13.402, 52.5],
            ],
          },
          {
            k: 'm',
            c: [
              [13.402, 52.5],
              [13.4025, 52.5005],
              [13.403, 52.5],
            ],
          },
        ],
      }),
    )
    expect(decodeRouteSearch(v1)?.waypoints).toEqual([
      { lon: 13.4, lat: 52.5, snapped: true, pinned: true },
      { lon: 13.402, lat: 52.5, snapped: true, pinned: true },
      { lon: 13.4025, lat: 52.5005, snapped: false, pinned: true },
      { lon: 13.403, lat: 52.5, snapped: false, pinned: true },
    ])
  })

  it('rejects garbage', () => {
    expect(decodeRouteSearch('not-a-route')).toBeUndefined()
    expect(decodeRouteSearch(undefined)).toBeUndefined()
  })
})
