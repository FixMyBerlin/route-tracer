import type { FeatureCollection, LineString } from 'geojson'
import { Layer, Source } from 'react-map-gl/maplibre'
import { useBelowRouteLayer } from '@/shared/map/use-below-route-layer'
import { TRACK_LINE_COLOR } from '@/shared/routing/constants'
import { TRACK_LAYER_ID, TRACK_SOURCE_ID } from '@/shared/routing/route-layer-ids'
import { useTrack } from '@/shared/track-source/track-store'

/** The uploaded track as a dashed line under the route, one feature per part. */
export function TrackLayers() {
  const belowRoute = useBelowRouteLayer()
  const track = useTrack()
  if (!track) return null

  const data: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: track.parts.map((coordinates) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {},
    })),
  }

  return (
    <>
      <Source id={TRACK_SOURCE_ID} type="geojson" data={data} />
      <Layer
        id={TRACK_LAYER_ID}
        type="line"
        source={TRACK_SOURCE_ID}
        beforeId={belowRoute}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': TRACK_LINE_COLOR,
          'line-width': 3,
          'line-opacity': 0.85,
          'line-dasharray': [1.5, 1.5],
        }}
      />
    </>
  )
}
