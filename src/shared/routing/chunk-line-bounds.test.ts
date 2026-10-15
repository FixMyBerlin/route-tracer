import { describe, expect, it } from 'vitest'
import { chunkLineBounds } from '@/shared/routing/chunk-line-bounds'

/** A straight line east, one vertex every ~68 m at this latitude. */
const line = Array.from({ length: 101 }, (_, index) => [13 + index * 0.001, 52])

describe('chunkLineBounds', () => {
  it('cuts a long line into overlapping chunks', () => {
    const chunks = chunkLineBounds(line, { chunkMeters: 1500 })
    // ~6.8 km in ~1.5 km pieces.
    expect(chunks.length).toBe(5)
    expect(chunks[1]?.positions[0]).toEqual(chunks[0]?.positions.at(-1))
    expect(chunks.at(-1)?.positions.at(-1)).toEqual(line.at(-1))
  })

  it('buffers each box around the line', () => {
    const [chunk] = chunkLineBounds(line.slice(0, 3), { bufferMeters: 110.54 })
    expect(chunk?.bounds.south).toBeCloseTo(51.999, 6)
    expect(chunk?.bounds.north).toBeCloseTo(52.001, 6)
    expect(chunk?.bounds.west).toBeLessThan(13)
  })

  it('keeps a single point as one chunk', () => {
    expect(chunkLineBounds([[13, 52]])).toHaveLength(1)
  })
})
