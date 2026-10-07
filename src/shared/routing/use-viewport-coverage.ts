import { useMap } from 'react-map-gl/maplibre'
import { useMapLoaded, useMapViewEpoch, useOsmStorageReady } from '@/shared/map/map-chrome-store'
import { viewMinZoom } from '@/shared/routing/constants'
import { coverageContainsPoint } from '@/shared/routing/coverage-contains-point'
import { scheduleCoverageFromMap } from '@/shared/routing/map-helpers'
import { useOsmCoverageFetch, useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'
import { viewportNeedsOsmFetch } from '@/shared/routing/viewport-needs-osm-fetch'

/**
 * What the road network looks like for the current map view, and how to load it.
 * Re-reads the view once the camera settles, not while it moves.
 */
export function useViewportCoverage(zoom: number) {
  const { mainMap } = useMap()
  const mapLoaded = useMapLoaded()
  // Subscribed only to re-render — and so re-read the bounds below — once the camera settles.
  useMapViewEpoch()
  const storageReady = useOsmStorageReady()
  const coverage = useOsmCoverageQuery({ select: (data) => data.coverage })
  const { loadOsmData, isFetching, error } = useOsmCoverageFetch()

  const map = mapLoaded ? (mainMap?.getMap() ?? null) : null
  const fetchArgs = map ? scheduleCoverageFromMap(map) : null
  const center = map?.getCenter()

  async function loadViewport(options?: { force?: boolean; clearPersistedOnForce?: boolean }) {
    if (!map) return
    await loadOsmData(scheduleCoverageFromMap(map), options)
  }

  return {
    /** Map and cached data are in place, so the view can be judged and loaded. */
    ready: map != null && storageReady,
    zoomTooLow: zoom < viewMinZoom,
    /** Some part of the view (plus its margin) is not loaded yet. */
    needsFetch:
      fetchArgs != null &&
      viewportNeedsOsmFetch(fetchArgs.bounds, coverage.data, fetchArgs.zoom, fetchArgs.mapSizePx),
    /** The middle of the view is loaded — enough to start working there. */
    centerLoaded: center ? coverageContainsPoint(coverage.data, center.lng, center.lat) : false,
    isFetching,
    error,
    loadViewport,
  }
}
