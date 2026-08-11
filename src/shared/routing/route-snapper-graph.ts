import type { ParsedOsmData } from '@osm-editor-kit/osm-data'
import { parsedOsmToXml } from '@/shared/routing/osm-xml'
import initOsmToRouteSnapper, {
  convert as convertOsmToRouteSnapper,
} from '../../../vendor/osm-to-route-snapper/osm_to_route_snapper.js'

let initPromise: Promise<void> | undefined

async function ensureOsmToRouteSnapperReady() {
  if (!initPromise) {
    initPromise = initOsmToRouteSnapper().then(() => undefined)
  }
  await initPromise
}

/**
 * Convert merged session OSM coverage into route-snapper bincode graph bytes.
 * Uses osm-to-route-snapper WASM (all highway=* ways; our Overpass query is road-like only).
 * Limitations: no boundary clip, Euclidean edge costs, one-ways ignored — sketching graph only.
 */
export async function buildRouteSnapperGraphBytes(data: ParsedOsmData) {
  const wayCount = Object.keys(data.ways).length
  if (wayCount === 0) return null

  await ensureOsmToRouteSnapperReady()
  const xml = parsedOsmToXml(data)
  const input = new TextEncoder().encode(xml)
  return convertOsmToRouteSnapper(input, '')
}

export function countRoadWays(data: ParsedOsmData) {
  return Object.keys(data.ways).length
}
