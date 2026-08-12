import { compileOverpassWaySelectors, matchesOsmWaySelection } from '@osm-editor-kit/osm-way-chain'
import { describe, expect, it } from 'vitest'
import { buildHighwaysOverpassQuery } from '@/shared/routing/overpass-highways'
import { routeTracerWayPolicy } from '@/shared/routing/route-tracer-way-policy'

const berlinBounds = {
  south: 52.48,
  west: 13.35,
  north: 52.52,
  east: 13.45,
}

describe('buildHighwaysOverpassQuery', () => {
  it('unions bike/foot policy clauses with access exclusions', () => {
    const query = buildHighwaysOverpassQuery(berlinBounds)

    expect(query).toContain('way[highway~"^(cycleway|')
    expect(query).toContain('way[highway=footway][footway!=sidewalk]')
    expect(query).toContain('way[highway=footway][footway=sidewalk][bicycle~"^(yes|designated)$"]')
    expect(query).toContain('way[highway=steps]')
    expect(query).toContain('[access!=private]')
    expect(query).toContain('[access!=no]')
    expect(query).toContain('(52.48,13.35,52.52,13.45)')
  })
})

describe('routeTracerWayPolicy', () => {
  it('matches the intended include/exclude rules', () => {
    expect(matchesOsmWaySelection({ highway: 'cycleway' }, routeTracerWayPolicy)).toBe(true)
    expect(matchesOsmWaySelection({ highway: 'steps' }, routeTracerWayPolicy)).toBe(true)
    expect(
      matchesOsmWaySelection({ highway: 'footway', footway: 'sidewalk' }, routeTracerWayPolicy),
    ).toBe(false)
    expect(
      matchesOsmWaySelection(
        { highway: 'footway', footway: 'sidewalk', bicycle: 'designated' },
        routeTracerWayPolicy,
      ),
    ).toBe(true)
    expect(
      matchesOsmWaySelection({ highway: 'residential', access: 'no' }, routeTracerWayPolicy),
    ).toBe(false)
  })

  it('compiles more than one Overpass selector branch', () => {
    expect(compileOverpassWaySelectors(routeTracerWayPolicy).length).toBeGreaterThan(1)
  })
})
