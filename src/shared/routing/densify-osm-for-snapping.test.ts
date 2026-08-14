import { emptyParsedOsmData } from '@osm-editor-kit/osm-data'
import { describe, expect, it } from 'vitest'
import {
  densifyInsertCount,
  densifyParsedOsmForSnapping,
} from '@/shared/routing/densify-osm-for-snapping'

describe('densifyInsertCount', () => {
  it('skips segments at or under the 12 m spacing', () => {
    expect(densifyInsertCount(8)).toBe(0)
    expect(densifyInsertCount(12)).toBe(0)
  })

  it('inserts a midpoint on 12–24 m segments (the old floor loop skipped these)', () => {
    expect(densifyInsertCount(13)).toBe(1)
    expect(densifyInsertCount(20)).toBe(1)
    expect(densifyInsertCount(23)).toBe(1)
  })

  it('spaces longer segments about every 12 m', () => {
    expect(densifyInsertCount(36)).toBe(2)
    expect(densifyInsertCount(100)).toBe(7)
  })
})

describe('densifyParsedOsmForSnapping', () => {
  it('adds a mid-block node on a 20 m way', () => {
    const data = emptyParsedOsmData()
    const lat = 51.26
    const metersPerLon = 111_320 * Math.cos((lat * Math.PI) / 180)
    data.nodeCoords[1] = [lat, 12.37]
    data.nodeCoords[2] = [lat, 12.37 + 20 / metersPerLon]
    data.ways[10] = {
      type: 'way',
      id: 10,
      nodes: [1, 2],
      version: 1,
      changeset: 0,
      tags: { highway: 'residential' },
    }

    const densified = densifyParsedOsmForSnapping(data)

    expect(densified.ways[10]?.nodes).toHaveLength(3)
    expect(Object.keys(densified.nodeCoords)).toHaveLength(3)
    expect(data.ways[10]?.nodes).toEqual([1, 2])
  })
})
