import type { OsmWay, ParsedOsmData } from '@osm-editor-kit/osm-data'

/** Insert extra OSM nodes so route-snapper can snap mid-block, not only at junctions. */
const SNAP_NODE_SPACING_METERS = 5

/** ~0.1 m — keys for original Overpass nodes vs densified inserts. */
const COORD_KEY_DECIMALS = 6

let lastOriginalOsmNodeKeys = new Set<string>()

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusMeters = 6_371_000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a))
}

function osmNodeCoordKey(lon: number, lat: number) {
  return `${lon.toFixed(COORD_KEY_DECIMALS)},${lat.toFixed(COORD_KEY_DECIMALS)}`
}

export function isOriginalOsmNode(lon: number, lat: number) {
  return lastOriginalOsmNodeKeys.has(osmNodeCoordKey(lon, lat))
}

/** How many extra nodes to place between two OSM nodes `lengthMeters` apart. */
export function densifyInsertCount(lengthMeters: number, spacingMeters = SNAP_NODE_SPACING_METERS) {
  if (lengthMeters <= spacingMeters) return 0
  return Math.max(1, Math.round(lengthMeters / spacingMeters) - 1)
}

function nextFreeId(record: Record<number, unknown>) {
  let next = 1
  for (const id of Object.keys(record)) {
    const numericId = Number(id)
    if (Number.isFinite(numericId) && numericId >= next) next = numericId + 1
  }
  return next
}

/**
 * route-snapper only snaps to graph nodes. OSM nodes are often only at junctions,
 * so a click on a road mid-block becomes freehand. Densify each way so snap
 * targets exist about every {@link SNAP_NODE_SPACING_METERS} along the carriageway.
 *
 * The graph builder decides what a node is: it splits ways into edges at junctions and
 * way ends, and folds every other vertex into edge geometry, where nothing can snap to it.
 * So each way is handed over one segment at a time — that makes both ends of every segment
 * a way end, and the inserted nodes survive as snap targets.
 */
export function densifyParsedOsmForSnapping(data: ParsedOsmData): ParsedOsmData {
  const originalKeys = new Set<string>()
  for (const coords of Object.values(data.nodeCoords)) {
    const [lat, lon] = coords
    if (typeof lat !== 'number' || typeof lon !== 'number') continue
    originalKeys.add(osmNodeCoordKey(lon, lat))
  }
  lastOriginalOsmNodeKeys = originalKeys

  const nodeCoords = { ...data.nodeCoords }
  const ways: Record<number, OsmWay> = {}
  let nextNodeId = nextFreeId(nodeCoords)
  let nextWayId = nextFreeId(data.ways)

  for (const way of Object.values(data.ways)) {
    const original = way.nodes
    if (original.length < 2) continue
    const densified: number[] = [original[0]!]
    for (let index = 1; index < original.length; index += 1) {
      const fromId = original[index - 1]!
      const toId = original[index]!
      const from = nodeCoords[fromId]
      const to = nodeCoords[toId]
      if (!from || !to) {
        densified.push(toId)
        continue
      }
      const [fromLat, fromLon] = from
      const [toLat, toLon] = to
      const length = haversineMeters(fromLat, fromLon, toLat, toLon)
      const insertCount = densifyInsertCount(length)
      for (let step = 1; step <= insertCount; step += 1) {
        const t = step / (insertCount + 1)
        const lat = fromLat + (toLat - fromLat) * t
        const lon = fromLon + (toLon - fromLon) * t
        const id = nextNodeId
        nextNodeId += 1
        nodeCoords[id] = [lat, lon]
        densified.push(id)
      }
      densified.push(toId)
    }

    for (let index = 1; index < densified.length; index += 1) {
      const id = nextWayId
      nextWayId += 1
      ways[id] = { ...way, id, nodes: [densified[index - 1]!, densified[index]!] }
    }
  }

  return {
    ...data,
    ways,
    nodeCoords,
  }
}
