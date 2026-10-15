import type { Position } from 'geojson'
import { describe, expect, it } from 'vitest'
import {
  sectionLengthsMeters,
  splitLineAtWaypoints,
} from '@/shared/routing/auto-snap/split-at-waypoints'
import { pathLengthMeters } from '@/shared/routing/haversine'

const a: Position = [13, 52]
const b: Position = [13.01, 52]
const c: Position = [13.01, 52.01]

describe('splitLineAtWaypoints', () => {
  it('splits an out-and-back route at the turnaround', () => {
    const line: Position[] = [a, b, a]
    const sections = splitLineAtWaypoints(line, [a, b, a])
    expect(sections).toHaveLength(2)
    expect(sections[0]?.at(-1)).toEqual(b)
    expect(sections[1]?.at(-1)).toEqual(a)
  })

  it('locates a waypoint that is visited twice in the right visit', () => {
    const line: Position[] = [a, b, a, c]
    const lengths = sectionLengthsMeters(line, [a, b, a, c])
    const out = Math.round(pathLengthMeters([a, b]))
    const back = Math.round(pathLengthMeters([b, a]))
    const last = Math.round(pathLengthMeters([a, c]))
    expect(lengths).toEqual([out, back, last])
  })

  it('starts the first section at 0 and ends the last at the line end', () => {
    const line: Position[] = [a, b, c]
    const sections = splitLineAtWaypoints(line, [a, b, c])
    expect(sections[0]?.[0]).toEqual(a)
    expect(sections.at(-1)?.at(-1)).toEqual(c)
  })

  it('returns no sections for fewer than two waypoints', () => {
    expect(splitLineAtWaypoints([a, b], [a])).toEqual([])
  })
})

describe('sectionLengthsMeters', () => {
  it('sums to the total route length', () => {
    const line: Position[] = [a, b, c]
    const lengths = sectionLengthsMeters(line, [a, b, c])
    const total = pathLengthMeters(line)
    expect(lengths).toHaveLength(2)
    expect(Math.abs(lengths.reduce((sum, length) => sum + length, 0) - total)).toBeLessThanOrEqual(
      lengths.length / 2,
    )
  })
})
