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

export function buildHighwaysOverpassQuery(bounds: MapBounds) {
  const bbox = boundsToOverpassBbox(bounds)
  const tag = overpassRoadLikeSelector()
  return compactOverpassQuery(`
    [out:xml];
    (
      way[${tag}](${bbox});
      >;
      way[${tag}](${bbox});
      <;
    );
    out meta;`)
}

export function buildHighwaysOverpassUrl(bounds: MapBounds) {
  return buildOverpassInterpreterUrl(overpassDeUrl, buildHighwaysOverpassQuery(bounds))
}
