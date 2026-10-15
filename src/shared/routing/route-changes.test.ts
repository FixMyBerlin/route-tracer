import { describe, expect, it } from 'vitest'
import { diffSectionLengths } from '@/shared/routing/route-changes'

describe('diffSectionLengths', () => {
  it('ignores rounding noise', () => {
    expect(diffSectionLengths([100, 400], [102, 410])).toEqual([])
  })

  it('reports a section that grew', () => {
    expect(diffSectionLengths([100, 412], [100, 455])).toEqual([
      { sectionIndex: 1, beforeMeters: 412, afterMeters: 455 },
    ])
  })

  it('needs the same number of sections', () => {
    expect(diffSectionLengths([100], [100, 200])).toEqual([])
  })
})
