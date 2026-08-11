import { describe, expect, it } from 'vitest'
import { buildHighwaysOverpassQuery } from '@/shared/routing/overpass-highways'

const berlinBounds = {
  south: 52.48,
  west: 13.35,
  north: 52.52,
  east: 13.45,
}

describe('buildHighwaysOverpassQuery', () => {
  it('closes the highway regex bracket before service/access filters', () => {
    const query = buildHighwaysOverpassQuery(berlinBounds)

    expect(query).toContain('"][service!=')
    expect(query).not.toMatch(/way\[highway~"[^"]+"\[service!=/)
  })
})
