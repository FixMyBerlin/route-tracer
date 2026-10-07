import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'

function ringContains(ring: Position[], lng: number, lat: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] ?? []
    const [xj, yj] = ring[j] ?? []
    if (xi == null || yi == null || xj == null || yj == null) continue
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function polygonContains(rings: Position[][], lng: number, lat: number) {
  const [outer, ...holes] = rings
  if (!outer || !ringContains(outer, lng, lat)) return false
  return !holes.some((hole) => ringContains(hole, lng, lat))
}

/** True when the point lies inside the loaded OSM coverage. */
export function coverageContainsPoint(
  coverage: Feature<Polygon | MultiPolygon> | null | undefined,
  lng: number,
  lat: number,
) {
  if (!coverage) return false
  const { geometry } = coverage
  return geometry.type === 'Polygon'
    ? polygonContains(geometry.coordinates, lng, lat)
    : geometry.coordinates.some((rings) => polygonContains(rings, lng, lat))
}
