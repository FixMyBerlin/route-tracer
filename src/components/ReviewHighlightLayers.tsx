import { Layer, Source } from 'react-map-gl/maplibre'
import { useBelowRouteLayer } from '@/shared/map/use-below-route-layer'
import { REVIEW_HIGHLIGHT_COLOR } from '@/shared/routing/constants'
import { reviewItemsGeoJson, type ReviewItem } from '@/shared/routing/review-item'
import { REVIEW_LAYER_ID, REVIEW_SOURCE_ID } from '@/shared/routing/route-layer-ids'

/** A wide glow under the route where the user should look. */
export function ReviewHighlightLayers({ items }: { items: ReviewItem[] }) {
  const belowRoute = useBelowRouteLayer()
  return (
    <>
      <Source id={REVIEW_SOURCE_ID} type="geojson" data={reviewItemsGeoJson(items)} />
      <Layer
        id={REVIEW_LAYER_ID}
        type="line"
        source={REVIEW_SOURCE_ID}
        beforeId={belowRoute}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': REVIEW_HIGHLIGHT_COLOR,
          'line-width': 16,
          'line-opacity': 0.45,
          'line-blur': 2,
        }}
      />
    </>
  )
}
