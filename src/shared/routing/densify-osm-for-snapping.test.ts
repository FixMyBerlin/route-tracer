import { emptyParsedOsmData } from '@osm-editor-kit/osm-data'
import { describe, expect, it } from 'vitest'
import {
  densifyInsertCount,
  densifyParsedOsmForSnapping,
  isOriginalOsmNode,
} from '@/shared/routing/densify-osm-for-snapping'

describe('densifyInsertCount', () => {
  it('skips segments at or under the 5 m spacing', () => {
    expect(densifyInsertCount(4)).toBe(0)
    expect(densifyInsertCount(5)).toBe(0)
  })

  it('inserts a midpoint on 5–10 m segments', () => {
    expect(densifyInsertCount(6)).toBe(1)
    expect(densifyInsertCount(9)).toBe(1)
  })

  it('spaces longer segments about every 5 m', () => {
    expect(densifyInsertCount(15)).toBe(2)
    expect(densifyInsertCount(20)).toBe(3)
    expect(densifyInsertCount(100)).toBe(19)
  })
})

describe('densifyParsedOsmForSnapping', () => {
  const lat = 51.26
  const metersPerLon = 111_320 * Math.cos((lat * Math.PI) / 180)

  /** One straight 20 m residential way. */
  function twentyMeterWay() {
    const data = emptyParsedOsmData()
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
    return data
  }

  it('adds mid-block nodes on a 20 m way (~5 m spacing)', () => {
    const data = twentyMeterWay()

    const densified = densifyParsedOsmForSnapping(data)

    expect(Object.keys(densified.nodeCoords)).toHaveLength(5)
    expect(data.ways[10]?.nodes).toEqual([1, 2])
    expect(isOriginalOsmNode(12.37, lat)).toBe(true)
    const midLon = 12.37 + 10 / metersPerLon
    expect(isOriginalOsmNode(midLon, lat)).toBe(false)
  })

  it('hands the way over one segment at a time, keeping order and tags', () => {
    const densified = densifyParsedOsmForSnapping(twentyMeterWay())
    const ways = Object.values(densified.ways)

    expect(ways).toHaveLength(4)
    expect(ways.map((way) => way.nodes)).toEqual([
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 2],
    ])
    expect(new Set(ways.map((way) => way.id)).size).toBe(4)
    expect(ways.every((way) => way.tags.highway === 'residential')).toBe(true)
  })
})
