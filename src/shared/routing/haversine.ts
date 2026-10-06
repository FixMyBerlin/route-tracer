import type { Position } from 'geojson'

const EARTH_RADIUS_METERS = 6_371_000

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a))
}

/** Length of a `[lng, lat]` path in meters. */
export function pathLengthMeters(coordinates: Position[]) {
  let length = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const [lng1, lat1] = coordinates[index - 1] ?? []
    const [lng2, lat2] = coordinates[index] ?? []
    if (lng1 == null || lat1 == null || lng2 == null || lat2 == null) continue
    length += haversineMeters(lat1, lng1, lat2, lng2)
  }
  return length
}
