import { describe, expect, it } from 'vitest'
import { joinTrackParts } from '@/shared/track-source/join-track-parts'

describe('joinTrackParts', () => {
  it('merges parts whose end touches the next start without a gap', () => {
    const joined = joinTrackParts([
      [
        [13, 52],
        [13.001, 52],
      ],
      [
        [13.001, 52],
        [13.002, 52],
      ],
    ])

    expect(joined).toEqual({
      coordinates: [
        [13, 52],
        [13.001, 52],
        [13.002, 52],
      ],
      gaps: [],
    })
  })

  it('treats a start within 1 m of the previous end as touching', () => {
    // About 0.34 m east at this latitude.
    const joined = joinTrackParts([
      [
        [13, 52],
        [13.001, 52],
      ],
      [
        [13.001005, 52],
        [13.002, 52],
      ],
    ])

    expect(joined.gaps).toEqual([])
    expect(joined.coordinates).toHaveLength(3)
  })

  it('bridges parts that do not touch and reports the gap indices', () => {
    const joined = joinTrackParts([
      [
        [13, 52],
        [13.001, 52],
      ],
      [
        [13.01, 52],
        [13.011, 52],
      ],
    ])

    expect(joined.coordinates).toEqual([
      [13, 52],
      [13.001, 52],
      [13.01, 52],
      [13.011, 52],
    ])
    expect(joined.gaps).toEqual([[1, 2]])
  })

  it('keeps file order and does not reverse parts', () => {
    const later = [
      [14, 53],
      [14.1, 53],
    ]
    const earlier = [
      [13, 52],
      [13.1, 52],
    ]

    const joined = joinTrackParts([later, earlier])

    expect(joined.coordinates[0]).toEqual([14, 53])
    expect(joined.coordinates.at(-1)).toEqual([13.1, 52])
    expect(joined.gaps).toEqual([[1, 2]])
  })

  it('returns an empty track for no parts', () => {
    expect(joinTrackParts([])).toEqual({ coordinates: [], gaps: [] })
  })
})
