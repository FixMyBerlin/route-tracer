import type { Feature, FeatureCollection, Point } from 'geojson'
import initRouteSnapper, { JsRouteSnapper } from 'route-snapper'

const emptyPointCollection: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
}

let routeSnapperInitPromise: Promise<void> | undefined

async function ensureRouteSnapperReady() {
  if (!routeSnapperInitPromise) {
    routeSnapperInitPromise = initRouteSnapper().then(() => undefined)
  }
  await routeSnapperInitPromise
}

function isPointFeature(feature: unknown): feature is Feature<Point> {
  if (typeof feature !== 'object' || feature == null) return false
  if (!('geometry' in feature)) return false
  const geometry = feature.geometry
  return (
    typeof geometry === 'object' &&
    geometry != null &&
    'type' in geometry &&
    geometry.type === 'Point'
  )
}

/** Keep Point features from route-snapper `debugSnappableNodes()` JSON. */
export function parseSnappableNodesGeoJson(raw: unknown): FeatureCollection<Point> {
  if (
    typeof raw !== 'object' ||
    raw == null ||
    !('features' in raw) ||
    !Array.isArray(raw.features)
  ) {
    return emptyPointCollection
  }

  const features = raw.features.filter(isPointFeature)
  return features.length === 0 ? emptyPointCollection : { type: 'FeatureCollection', features }
}

/**
 * Nodes route-snapper will actually snap to — not every vertex on graph LineStrings.
 * @see JsRouteSnapper.debugSnappableNodes
 */
export async function snappableNodesFromGraphBytes(
  graphBytes: Uint8Array,
): Promise<FeatureCollection<Point>> {
  await ensureRouteSnapperReady()
  const snapper = new JsRouteSnapper(graphBytes)
  try {
    return parseSnappableNodesGeoJson(JSON.parse(snapper.debugSnappableNodes()) as unknown)
  } finally {
    snapper.free()
  }
}

export { emptyPointCollection }
