import { useMap } from 'react-map-gl/maplibre'
import { ROUTE_SNAPPED_LAYER_ID } from '@/shared/routing/route-layer-ids'

/**
 * `beforeId` that slides a layer under the route. Right after a reload a layer can be added
 * before the route's own layers exist; MapLibre throws for an unknown `beforeId`, and adding it
 * on top is right anyway, since the route layers then go above it.
 */
export function useBelowRouteLayer() {
  const { current } = useMap()
  return current?.getMap().getLayer(ROUTE_SNAPPED_LAYER_ID) ? ROUTE_SNAPPED_LAYER_ID : undefined
}
