import {
  boundsToOverpassBbox,
  buildOverpassInterpreterUrl,
  overpassDeUrl,
  overpassVkUrl,
} from '@osm-editor-kit/osm-coverage'
import type { MapBounds } from '@osm-editor-kit/osm-data'
import { overpassRoadLikeSelector } from '@osm-editor-kit/osm-way-chain'

function compactOverpassQuery(query: string) {
  return query.replace(/\s+/g, ' ').trim()
}

function waySelectorFromRoadLike(tag: string) {
  // tag: highway~"..." or highway~"..."[service!=...][access!=private]
  const withClosedFirstBracket = tag.includes('[') ? `[${tag.replace('[', '][')}` : `[${tag}]`
  return withClosedFirstBracket
}

export function buildHighwaysOverpassQuery(bounds: MapBounds) {
  const bbox = boundsToOverpassBbox(bounds)
  const tag = overpassRoadLikeSelector()
  const selector = waySelectorFromRoadLike(tag)
  return compactOverpassQuery(`
    [out:xml][timeout:60];
    (
      way${selector}(${bbox});
    );
    (._;>;);
    out meta;`)
}

export function buildHighwaysOverpassUrl(bounds: MapBounds, server: 'de' | 'vk' = 'vk') {
  const base = server === 'vk' ? overpassVkUrl : overpassDeUrl
  return buildOverpassInterpreterUrl(base, buildHighwaysOverpassQuery(bounds))
}

/** Primary DE interpreter, then VK fallback — helps after local 429 storms. */
export function buildHighwaysOverpassUrls(bounds: MapBounds) {
  return [buildHighwaysOverpassUrl(bounds, 'de'), buildHighwaysOverpassUrl(bounds, 'vk')] as const
}
