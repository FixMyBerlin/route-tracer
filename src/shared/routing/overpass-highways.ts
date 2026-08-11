import {
  boundsToOverpassBbox,
  buildOverpassInterpreterUrl,
  overpassDeUrl,
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

export function buildHighwaysOverpassUrl(bounds: MapBounds) {
  return buildOverpassInterpreterUrl(overpassDeUrl, buildHighwaysOverpassQuery(bounds))
}
