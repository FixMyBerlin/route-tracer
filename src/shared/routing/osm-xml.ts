import { emptyParsedOsmData, type ParsedOsmData } from '@osm-editor-kit/osm-data'
import type { OsmNode, OsmTags, OsmWay } from '@osm-editor-kit/osm-data'

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderTags(tags: OsmTags) {
  return Object.entries(tags)
    .map(([key, value]) => `<tag k="${escapeXml(key)}" v="${escapeXml(value)}"/>`)
    .join('')
}

function renderNode(node: OsmNode) {
  return `<node id="${node.id}" lat="${node.lat}" lon="${node.lon}" version="${node.version}" changeset="${node.changeset}"/>`
}

function renderWay(way: OsmWay) {
  const nds = way.nodes.map((nodeId) => `<nd ref="${nodeId}"/>`).join('')
  return `<way id="${way.id}" version="${way.version}" changeset="${way.changeset}">${nds}${renderTags(way.tags)}</way>`
}

/** Minimal OSM XML for osm-to-route-snapper (highway ways + referenced nodes). */
export function parsedOsmToXml(data: ParsedOsmData) {
  const nodeIds = new Set<number>()
  for (const way of Object.values(data.ways)) {
    for (const nodeId of way.nodes) {
      nodeIds.add(nodeId)
    }
  }

  const nodes = [...nodeIds]
    .map((nodeId) => {
      const node = data.nodes[nodeId]
      if (node) return renderNode(node)
      const coords = data.nodeCoords[nodeId]
      if (!coords) return null
      return `<node id="${nodeId}" lat="${coords[0]}" lon="${coords[1]}" version="1" changeset="0"/>`
    })
    .filter((line): line is string => line != null)
    .join('')

  const ways = Object.values(data.ways).map(renderWay).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><osm version="0.6" generator="route-tracer">${nodes}${ways}</osm>`
}

function readTags(element: Element) {
  const tags: OsmTags = {}
  for (const tag of element.querySelectorAll(':scope > tag')) {
    const key = tag.getAttribute('k')
    const value = tag.getAttribute('v')
    if (key != null && value != null) tags[key] = value
  }
  return tags
}

function readVersion(element: Element) {
  return Number(element.getAttribute('version') ?? '1')
}

function readChangeset(element: Element) {
  return Number(element.getAttribute('changeset') ?? '0')
}

/** Parse Overpass / OSM API XML into ParsedOsmData. */
export function parseOsmXml(xml: string): ParsedOsmData {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Failed to parse OSM XML response')
  }

  const parsed = emptyParsedOsmData()

  for (const element of doc.querySelectorAll('node')) {
    const id = Number(element.getAttribute('id'))
    const lat = Number(element.getAttribute('lat'))
    const lon = Number(element.getAttribute('lon'))
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue

    parsed.nodeCoords[id] = [lat, lon]
    const tags = readTags(element)
    if (Object.keys(tags).length > 0) {
      parsed.nodes[id] = {
        type: 'node',
        id,
        lat,
        lon,
        version: readVersion(element),
        changeset: readChangeset(element),
        tags,
      }
    }
  }

  for (const element of doc.querySelectorAll('way')) {
    const id = Number(element.getAttribute('id'))
    if (!Number.isFinite(id)) continue

    const nodes = [...element.querySelectorAll(':scope > nd')]
      .map((nd) => Number(nd.getAttribute('ref')))
      .filter((nodeId) => Number.isFinite(nodeId))

    parsed.ways[id] = {
      type: 'way',
      id,
      nodes,
      version: readVersion(element),
      changeset: readChangeset(element),
      tags: readTags(element),
    }
  }

  return parsed
}

export async function downloadOsmXmlCoverage(url: string): Promise<ParsedOsmData> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`)
  }
  const xml = await response.text()
  return parseOsmXml(xml)
}
