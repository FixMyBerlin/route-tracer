import type { Position } from 'geojson'
import type { ParsedOsmData } from '@osm-editor-kit/osm-data'

/**
 * A generated street grid and tracks that walk it, for benchmarks and tests that need more road
 * than the small hand-drawn fixture. Everything is seeded, so a size and seed always give the same
 * city and the same track.
 */

const ORIGIN_LON = 13.4
const ORIGIN_LAT = 52.5
const METERS_PER_DEGREE_LAT = 110_540
const METERS_PER_DEGREE_LON = 111_320 * Math.cos((ORIGIN_LAT * Math.PI) / 180)

export type GridCity = {
  /** Side length in nodes; the city has `size * size` nodes. */
  size: number
  spacingMeters: number
  /** Parsed OSM as Overpass would deliver it, before densification. */
  data: ParsedOsmData
}

export type GridCityOptions = {
  size?: number
  spacingMeters?: number
  /** Every n-th block gets a diagonal street across it. */
  diagonalEvery?: number
}

/** Deterministic PRNG (mulberry32): the same seed always gives the same sequence. */
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Street grid: one way per row and column, plus diagonal streets through some blocks. */
export function createGridCity({
  size = 60,
  spacingMeters = 100,
  diagonalEvery = 4,
}: GridCityOptions = {}): GridCity {
  const nodeId = (row: number, column: number) => row * size + column + 1
  const nodeCoords: Record<number, [number, number]> = {}
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const lat = ORIGIN_LAT + (row * spacingMeters) / METERS_PER_DEGREE_LAT
      const lon = ORIGIN_LON + (column * spacingMeters) / METERS_PER_DEGREE_LON
      nodeCoords[nodeId(row, column)] = [lat, lon]
    }
  }

  const ways: ParsedOsmData['ways'] = {}
  let wayId = 1
  const addWay = (nodes: number[]) => {
    ways[wayId] = {
      id: wayId,
      type: 'way',
      version: 1,
      changeset: 1,
      tags: { highway: 'residential' },
      nodes,
    }
    wayId += 1
  }
  for (let row = 0; row < size; row += 1) {
    addWay(Array.from({ length: size }, (_, column) => nodeId(row, column)))
  }
  for (let column = 0; column < size; column += 1) {
    addWay(Array.from({ length: size }, (_, row) => nodeId(row, column)))
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      if ((row + column) % diagonalEvery === 0) {
        addWay([nodeId(row, column), nodeId(row + 1, column + 1)])
      }
    }
  }

  return {
    size,
    spacingMeters,
    data: {
      relations: {},
      ways,
      nodes: {},
      nodeCoords,
      waysInRelation: {},
    },
  }
}

export type GridTrackOptions = {
  lengthMeters: number
  seed?: number
  /** Distance between raw points. A phone at walking pace logs about every 5 m. */
  pointSpacingMeters?: number
  /** Standard deviation of the per-point GPS noise. */
  noiseMeters?: number
  /** Share of legs that cut straight through blocks, off the streets. */
  cutProbability?: number
}

type Point = { x: number; y: number }

/** A random walk along the grid: straight legs of a few blocks, turning at junctions. */
function walkCorners(city: GridCity, lengthMeters: number, options: GridTrackOptions) {
  const random = seededRandom(options.seed ?? 1)
  const { size, spacingMeters } = city
  const cutProbability = options.cutProbability ?? 0.08
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const

  let row = Math.floor(random() * size)
  let column = Math.floor(random() * size)
  const corners: Array<[number, number]> = [[row, column]]
  let walked = 0
  while (walked < lengthMeters) {
    let dRow = 0
    let dColumn = 0
    let blocks = 1 + Math.floor(random() * 6)
    const cut = random() < cutProbability
    if (cut) {
      // Diagonal through blocks: on a street only at the junctions it passes.
      const signRow = random() < 0.5 ? 1 : -1
      const signColumn = random() < 0.5 ? 1 : -1
      dRow = signRow
      dColumn = signColumn
      blocks = 1 + Math.floor(random() * 3)
    } else {
      const [straightRow, straightColumn] = directions[Math.floor(random() * 4)] ?? [1, 0]
      dRow = straightRow
      dColumn = straightColumn
    }
    const target = [row + dRow * blocks, column + dColumn * blocks] as const
    if (target[0] < 0 || target[0] >= size || target[1] < 0 || target[1] >= size) continue
    walked += cut ? Math.hypot(blocks, blocks) * spacingMeters : blocks * spacingMeters
    row = target[0]
    column = target[1]
    corners.push([row, column])
  }
  return { corners, random }
}

/**
 * A GPS-like track that walks the city's streets (with some off-road cuts), sampled every few
 * meters and jittered. Positions are `[lon, lat]`.
 */
export function createGridTrack(city: GridCity, options: GridTrackOptions): Position[] {
  const pointSpacing = options.pointSpacingMeters ?? 5
  const noise = options.noiseMeters ?? 3
  const { corners, random } = walkCorners(city, options.lengthMeters, options)
  const gaussian = () => {
    const u = Math.max(random(), 1e-12)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
  }

  const toMeters = ([row, column]: [number, number]): Point => ({
    x: column * city.spacingMeters,
    y: row * city.spacingMeters,
  })
  const toLonLat = ({ x, y }: Point): Position => [
    ORIGIN_LON + x / METERS_PER_DEGREE_LON,
    ORIGIN_LAT + y / METERS_PER_DEGREE_LAT,
  ]

  const track: Position[] = []
  let walked = 0
  for (let index = 1; index < corners.length && walked < options.lengthMeters; index += 1) {
    const from = toMeters(corners[index - 1] as [number, number])
    const to = toMeters(corners[index] as [number, number])
    const legLength = Math.hypot(to.x - from.x, to.y - from.y)
    const steps = Math.max(1, Math.ceil(legLength / pointSpacing))
    for (let step = index === 1 ? 0 : 1; step <= steps; step += 1) {
      const t = step / steps
      const point = {
        x: from.x + (to.x - from.x) * t + gaussian() * noise,
        y: from.y + (to.y - from.y) * t + gaussian() * noise,
      }
      track.push(toLonLat(point))
    }
    walked += legLength
  }
  return track
}
