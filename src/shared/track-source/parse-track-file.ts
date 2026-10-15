import type { Position } from 'geojson'

export type ParsedTrack = {
  /** Optional name from the file (GPX <trk><name>/<rte><name>, GeoJSON properties.name). */
  name?: string
  /** Each continuous part in file order; every part has >= 2 positions [lon, lat] (no elevation). */
  parts: Position[][]
}

export class TrackParseError extends Error {}

const GPX_CONTAINERS = new Set(['trk', 'trkseg', 'rte'])
const GPX_NAME_PARENTS = new Set(['trk', 'rte'])
const POSITION_KEY_SCALE = 1e7

/** Detects the format from the content (leading '<' is GPX, '{' is GeoJSON), then the file name. */
export function parseTrackText(text: string, fileName?: string): ParsedTrack {
  const content = text.replace(/^﻿/, '').trimStart()
  if (content === '') throw new TrackParseError('The file is empty.')

  const format = detectFormat(content, fileName)
  if (format === 'gpx') return parseGpx(content)
  if (format === 'geojson') return parseGeoJson(content)
  throw new TrackParseError('Unsupported file. Choose a GPX or GeoJSON file.')
}

function detectFormat(content: string, fileName?: string): 'gpx' | 'geojson' | undefined {
  if (content.startsWith('<')) return 'gpx'
  if (content.startsWith('{')) return 'geojson'

  const extension = fileName?.toLowerCase().match(/\.([^.]+)$/)?.[1]
  if (extension === 'gpx') return 'gpx'
  if (extension === 'geojson' || extension === 'json') return 'geojson'
  return undefined
}

function parseGpx(text: string): ParsedTrack {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new TrackParseError('The GPX file is not valid XML.')
  }

  // Matching on localName works for the default namespace and for any prefix.
  const elements = [...doc.getElementsByTagName('*')]
  const named = (...localNames: string[]) =>
    elements.filter((element) => localNames.includes(element.localName))

  const pointsByContainer = new Map<Element, Position[]>()
  let pointCount = 0
  for (const point of named('trkpt', 'rtept')) {
    const container = gpxContainer(point)
    if (!container) continue
    pointCount += 1
    let positions = pointsByContainer.get(container)
    if (!positions) {
      positions = []
      pointsByContainer.set(container, positions)
    }
    positions.push(gpxPosition(point))
  }
  if (pointCount === 0) throw new TrackParseError('The GPX file has no track or route points.')

  // Segments and routes are the parts; loose trkpt in a trk only count when there are none.
  const segments = named('trkseg', 'rte')
  const owners = segments.length > 0 ? segments : named('trk')
  const parts = cleanParts(owners.map((owner) => pointsByContainer.get(owner) ?? []))
  if (parts.length === 0) {
    throw new TrackParseError('The GPX file has no usable track or route points.')
  }

  const name = named('name')
    .find(
      (element) => element.parentElement && GPX_NAME_PARENTS.has(element.parentElement.localName),
    )
    ?.textContent?.trim()
  return { ...(name ? { name } : {}), parts }
}

/** The nearest trk, trkseg or rte ancestor of a point. */
function gpxContainer(point: Element): Element | undefined {
  for (let element = point.parentElement; element; element = element.parentElement) {
    if (GPX_CONTAINERS.has(element.localName)) return element
  }
  return undefined
}

function gpxPosition(point: Element): Position {
  return [parseCoordinate(point.getAttribute('lon')), parseCoordinate(point.getAttribute('lat'))]
}

function parseCoordinate(value: string | null): number {
  if (value === null || value.trim() === '') return Number.NaN
  return Number(value)
}

function parseGeoJson(text: string): ParsedTrack {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new TrackParseError('The file is not valid JSON.')
  }

  const rawParts: Position[][] = []
  let name: string | undefined

  if (isRecord(json) && json.type === 'FeatureCollection') {
    const features = Array.isArray(json.features) ? (json.features as unknown[]) : []
    name = featureName(features[0])
    for (const feature of features) collectFeature(feature, rawParts)
  } else if (isRecord(json) && json.type === 'Feature') {
    name = featureName(json)
    collectFeature(json, rawParts)
  } else {
    collectGeometry(json, rawParts)
  }

  if (rawParts.length === 0) {
    throw new TrackParseError('The GeoJSON file has no line geometry.')
  }

  const parts = cleanParts(rawParts)
  if (parts.length === 0) {
    throw new TrackParseError('The GeoJSON file has no usable line coordinates.')
  }
  return { ...(name ? { name } : {}), parts }
}

function collectFeature(feature: unknown, parts: Position[][]) {
  if (isRecord(feature)) collectGeometry(feature.geometry, parts)
}

function collectGeometry(geometry: unknown, parts: Position[][]) {
  if (!isRecord(geometry)) return

  if (geometry.type === 'LineString') {
    parts.push(readPositions(geometry.coordinates))
  } else if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
    for (const line of geometry.coordinates as unknown[]) parts.push(readPositions(line))
  } else if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    for (const child of geometry.geometries as unknown[]) collectGeometry(child, parts)
  }
}

function readPositions(value: unknown): Position[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[]).map((position) => {
    if (Array.isArray(position)) {
      const [lon, lat] = position as unknown[]
      if (typeof lon === 'number' && typeof lat === 'number') return [lon, lat]
    }
    return [Number.NaN, Number.NaN]
  })
}

function featureName(feature: unknown): string | undefined {
  if (!isRecord(feature) || !isRecord(feature.properties)) return undefined
  const name = feature.properties.name
  if (typeof name !== 'string') return undefined
  return name.trim() || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Drops invalid and repeated points, then parts too short to draw. */
function cleanParts(rawParts: Position[][]): Position[][] {
  const parts: Position[][] = []

  for (const rawPart of rawParts) {
    const part: Position[] = []
    let previousKey: string | undefined

    for (const position of rawPart) {
      const lon = position[0] ?? Number.NaN
      const lat = position[1] ?? Number.NaN
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) continue

      const key = `${Math.round(lon * POSITION_KEY_SCALE)},${Math.round(lat * POSITION_KEY_SCALE)}`
      if (key === previousKey) continue
      previousKey = key
      part.push([lon, lat])
    }

    if (part.length >= 2) parts.push(part)
  }

  return parts
}
