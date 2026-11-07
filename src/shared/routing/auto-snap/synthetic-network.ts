import { emptyParsedOsmData, type ParsedOsmData } from '@osm-editor-kit/osm-data'
import { buildRouteSnapperGraphBytes } from '@osm-editor-kit/osm-route-snapper'
import type { Position } from 'geojson'
import { densifyParsedOsmForSnapping } from '@/shared/routing/densify-osm-for-snapping'
import { haversineMeters } from '@/shared/routing/haversine'

/** Test-only: a small road network built in code, so tests need no Overpass data. */

/** Origin of every synthetic network, near Berlin like the rest of the app's tests. */
export const ORIGIN = { lon: 13.4, lat: 52.5 }

/** A point `eastMeters` east and `northMeters` north of {@link ORIGIN}. */
export function local(eastMeters: number, northMeters: number): Position {
  const lat = ORIGIN.lat + northMeters / 111_195
  const lon = ORIGIN.lon + eastMeters / (111_195 * Math.cos((ORIGIN.lat * Math.PI) / 180))
  return [lon, lat]
}

export type SyntheticRoad = {
  /** Vertices in lon/lat; identical vertices of different roads become one junction node. */
  points: Position[]
  highway?: string
}

/** Builds the graph the app builds from Overpass: densified, then route-snapper's own format. */
export async function buildSyntheticGraph(roads: SyntheticRoad[]): Promise<Uint8Array> {
  const data = emptyParsedOsmData()
  const nodeIdByKey = new Map<string, number>()
  let nextNodeId = 1
  let nextWayId = 1

  const nodeFor = (position: Position) => {
    const lon = position[0] ?? 0
    const lat = position[1] ?? 0
    const key = `${lon.toFixed(8)},${lat.toFixed(8)}`
    const existing = nodeIdByKey.get(key)
    if (existing !== undefined) return existing
    const id = nextNodeId
    nextNodeId += 1
    nodeIdByKey.set(key, id)
    data.nodeCoords[id] = [lat, lon]
    data.nodes[id] = { id, type: 'node', lat, lon, version: 1, changeset: 0, tags: {} }
    return id
  }

  for (const road of roads) {
    const id = nextWayId
    nextWayId += 1
    data.ways[id] = {
      id,
      type: 'way',
      version: 1,
      changeset: 0,
      tags: { highway: road.highway ?? 'residential' },
      nodes: road.points.map(nodeFor),
    }
  }

  return (await buildRouteSnapperGraphBytes(densifyParsedOsmForSnapping(data))) ?? new Uint8Array()
}

/** Straight streets from each `from` to `to`, one road each. */
export function straight(...corners: [number, number][]): SyntheticRoad {
  return { points: corners.map(([east, north]) => local(east, north)) }
}

/** Points every `stepMeters` along the polyline `corners` (east/north meters), the ends included. */
export function polylineMeters(corners: [number, number][], stepMeters = 10): Position[] {
  const points: Position[] = []
  for (let index = 1; index < corners.length; index += 1) {
    const [east1, north1] = corners[index - 1] ?? [0, 0]
    const [east2, north2] = corners[index] ?? [0, 0]
    const length = Math.hypot(east2 - east1, north2 - north1)
    const count = Math.max(1, Math.ceil(length / stepMeters))
    for (let step = 0; step < count; step += 1) {
      const t = step / count
      points.push(local(east1 + (east2 - east1) * t, north1 + (north2 - north1) * t))
    }
  }
  const last = corners.at(-1) ?? [0, 0]
  points.push(local(last[0], last[1]))
  return points
}

/** Deterministic pseudo-random value in [-1, 1] for index `i` and channel `salt`. */
function jitter(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

/**
 * GPS-like noise: each vertex moves up to `amplitudeMeters` east and north. Deterministic, so
 * the test results are the same on every run.
 */
export function withGpsNoise(line: Position[], amplitudeMeters: number, salt = 1): Position[] {
  return line.map((position, index) => {
    const [lon = 0, lat = 0] = position
    const east = jitter(index, salt) * amplitudeMeters
    const north = jitter(index, salt + 0.5) * amplitudeMeters
    const metersPerDegreeLon = 111_195 * Math.cos((lat * Math.PI) / 180)
    return [lon + east / metersPerDegreeLon, lat + north / 111_195]
  })
}

/** Length of a line in meters, for reporting. */
export function lengthMeters(line: Position[]) {
  let total = 0
  for (let index = 1; index < line.length; index += 1) {
    const [lon1 = 0, lat1 = 0] = line[index - 1] ?? []
    const [lon2 = 0, lat2 = 0] = line[index] ?? []
    total += haversineMeters(lat1, lon1, lat2, lon2)
  }
  return total
}
