import { Layer, Source } from 'react-map-gl/maplibre'
import { coverageUnloadedMask } from '@/shared/routing/coverage-mask'
import { useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { ROUTE_SNAPPED_LAYER_ID } from '@/shared/routing/route-layer-ids'

const COVERAGE_MASK_SOURCE_ID = 'osm-coverage-mask'
const COVERAGE_MASK_FILL_LAYER_ID = 'osm-coverage-mask-fill'
const COVERAGE_MASK_LINE_LAYER_ID = 'osm-coverage-mask-line'

/**
 * Gray overlay of the world minus loaded OSM coverage bboxes.
 * Hidden until the first coverage polygon is in the store.
 */
export function CoverageMaskLayers() {
  const coverage = useOsmCoverageQuery({
    select: (data) => data.coverage,
  })
  if (coverage.data == null) return null

  return (
    <>
      <Source
        id={COVERAGE_MASK_SOURCE_ID}
        type="geojson"
        data={coverageUnloadedMask(coverage.data)}
      />
      <Layer
        id={COVERAGE_MASK_FILL_LAYER_ID}
        type="fill"
        source={COVERAGE_MASK_SOURCE_ID}
        beforeId={ROUTE_SNAPPED_LAYER_ID}
        paint={{
          'fill-color': '#0f172a',
          'fill-opacity': 0.4,
        }}
      />
      <Layer
        id={COVERAGE_MASK_LINE_LAYER_ID}
        type="line"
        source={COVERAGE_MASK_SOURCE_ID}
        beforeId={ROUTE_SNAPPED_LAYER_ID}
        paint={{
          'line-color': '#1e293b',
          'line-width': 1,
        }}
      />
    </>
  )
}
