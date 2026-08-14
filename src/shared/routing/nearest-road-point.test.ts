import { describe, expect, it } from 'vitest'
import {
  ROAD_SNAP_RADIUS_METERS,
  linesFromCoordinates,
  nearestPointOnLines,
} from '@/shared/routing/nearest-road-point'

describe('nearestPointOnLines', () => {
  const lat = 51.26
  const metersPerLon = 111_320 * Math.cos((lat * Math.PI) / 180)
  const origin: [number, number] = [12.37, lat]
  const east20: [number, number] = [12.37 + 20 / metersPerLon, lat]
  const roads = linesFromCoordinates([[origin, east20]])

  it('projects a point onto the nearest road within 5 m', () => {
    const offNorth = 3 / 111_320
    const clickLon = origin[0] + 10 / metersPerLon
    const found = nearestPointOnLines(roads, clickLon, lat + offNorth)

    expect(found).not.toBeNull()
    expect(found?.distMeters).toBeGreaterThan(2)
    expect(found?.distMeters).toBeLessThan(4)
    expect(found?.lat).toBeCloseTo(lat, 6)
    expect(found?.lon).toBeCloseTo(clickLon, 6)
  })

  it('returns null when the click is farther than the search radius', () => {
    const offNorth = 10 / 111_320
    expect(nearestPointOnLines(roads, origin[0], lat + offNorth)).toBeNull()
    expect(
      nearestPointOnLines(roads, origin[0], lat + offNorth, ROAD_SNAP_RADIUS_METERS),
    ).toBeNull()
  })

  it('returns the click when it already lies on the line', () => {
    const found = nearestPointOnLines(roads, origin[0], origin[1])
    expect(found?.distMeters).toBeLessThan(0.5)
    expect(found?.lon).toBeCloseTo(origin[0], 6)
    expect(found?.lat).toBeCloseTo(origin[1], 6)
  })
})
