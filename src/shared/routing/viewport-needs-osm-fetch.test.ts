import { polygon } from '@turf/helpers'
import { describe, expect, it } from 'vitest'
import { viewportNeedsOsmFetch } from '@/shared/routing/viewport-needs-osm-fetch'

const viewport = { west: 13.4, south: 52.5, east: 13.41, north: 52.51 }
const mapSizePx = { width: 1024, height: 768 }

describe('viewportNeedsOsmFetch', () => {
  it('needs a fetch when nothing is covered yet', () => {
    expect(viewportNeedsOsmFetch(viewport, null, 16, mapSizePx)).toBe(true)
  })

  it('does not fetch below the minimum zoom', () => {
    expect(viewportNeedsOsmFetch(viewport, null, 14, mapSizePx)).toBe(false)
  })

  it('does not fetch when coverage already contains the viewport', () => {
    const coverage = polygon([
      [
        [13.3, 52.4],
        [13.5, 52.4],
        [13.5, 52.6],
        [13.3, 52.6],
        [13.3, 52.4],
      ],
    ])
    expect(viewportNeedsOsmFetch(viewport, coverage, 16, mapSizePx)).toBe(false)
  })
})
