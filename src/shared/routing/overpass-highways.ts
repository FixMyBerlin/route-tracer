import {
  boundsToOverpassBbox,
  buildOverpassInterpreterUrl,
  overpassDeUrl,
  overpassVkUrl,
} from '@osm-editor-kit/osm-coverage'
import type { MapBounds } from '@osm-editor-kit/osm-data'
import { buildWaysOverpassQuery } from '@osm-editor-kit/osm-way-chain'
import { routeTracerWayPolicy } from '@/shared/routing/route-tracer-way-policy'

function compactOverpassQuery(query: string) {
  return query.replace(/\s+/g, ' ').trim()
}

export function buildHighwaysOverpassQuery(bounds: MapBounds) {
  const bbox = boundsToOverpassBbox(bounds)
  return compactOverpassQuery(buildWaysOverpassQuery(routeTracerWayPolicy, bbox))
}

export function buildHighwaysOverpassUrl(bounds: MapBounds, server: 'de' | 'vk' = 'vk') {
  const base = server === 'vk' ? overpassVkUrl : overpassDeUrl
  return buildOverpassInterpreterUrl(base, buildHighwaysOverpassQuery(bounds))
}

/** Primary DE interpreter, then VK fallback — helps after local 429 storms. */
export function buildHighwaysOverpassUrls(bounds: MapBounds) {
  return [buildHighwaysOverpassUrl(bounds, 'de'), buildHighwaysOverpassUrl(bounds, 'vk')] as const
}
