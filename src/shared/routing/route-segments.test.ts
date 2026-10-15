import { describe, expect, it } from 'vitest'
import { routeLineToSegments } from '@/shared/routing/route-segments'

describe('routeLineToSegments', () => {
  it('joins snapped sections and splits off freehand ones', () => {
    const line = [
      [13.4, 52.5],
      [13.401, 52.5],
      [13.402, 52.5],
      [13.403, 52.501],
    ]
    const segments = routeLineToSegments(line, [
      { lon: 13.4, lat: 52.5, snapped: true },
      { lon: 13.401, lat: 52.5, snapped: true },
      { lon: 13.402, lat: 52.5, snapped: true },
      { lon: 13.403, lat: 52.501, snapped: false },
    ])
    expect(segments.map((segment) => segment.segment_kind)).toEqual(['snapped', 'manual'])
    expect(segments[0]?.coordinates).toEqual([
      [13.4, 52.5],
      [13.401, 52.5],
      [13.402, 52.5],
    ])
    expect(segments[1]?.coordinates.at(-1)).toEqual([13.403, 52.501])
  })
})
