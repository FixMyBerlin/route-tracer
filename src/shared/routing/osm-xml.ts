import { emptyParsedOsmData, type ParsedOsmData } from '@osm-editor-kit/osm-data'
import type { OsmTags } from '@osm-editor-kit/osm-data'

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
  const response = await fetch(url, {
    headers: {
      Accept: 'application/osm3s+xml, application/xml, text/xml, */*',
    },
  })
  if (!response.ok) {
    throw new Error(`Request failed with status code ${response.status}`)
  }
  const xml = await response.text()
  return parseOsmXml(xml)
}
