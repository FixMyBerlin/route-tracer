import { Layer, Source } from 'react-map-gl/maplibre'
import { useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { useShowCoverageDebug } from '@/shared/routing/routing-ui-store'

export function CoverageDebugOverlay() {
  const enabled = useShowCoverageDebug()
  const coverage = useOsmCoverageQuery({
    select: (data) => data.coverage,
  })

  if (!enabled || !coverage.data) return null

  return (
    <Source id="osm-coverage-debug" type="geojson" data={coverage.data}>
      <Layer
        id="osm-coverage-debug-fill"
        type="fill"
        paint={{
          'fill-color': '#38bdf8',
          'fill-opacity': 0.08,
        }}
      />
      <Layer
        id="osm-coverage-debug-line"
        type="line"
        paint={{
          'line-color': '#38bdf8',
          'line-width': 2,
          'line-dasharray': [2, 2],
        }}
      />
    </Source>
  )
}
