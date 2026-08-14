import type { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect } from 'react'
import { useMapChromeActions } from '@/shared/map/map-chrome-store'
import { scheduleCoverageFromMap } from '@/shared/routing/map-helpers'
import { useOsmCoverageFetch } from '@/shared/routing/osm-coverage-query'
import { useRestoreOsmCoverage } from '@/shared/routing/use-restore-osm-coverage'

/** Hydrate cached OSM coverage and expose a manual viewport load. Does not fetch on pan. */
export function useRouteCoveragePace() {
  const storageReady = useRestoreOsmCoverage()
  const { loadOsmData, isFetching } = useOsmCoverageFetch()
  const { setOsmDataBusy, setOsmStorageReady } = useMapChromeActions()

  useEffect(
    function publishOsmCoverageBusy() {
      setOsmDataBusy(isFetching)
    },
    [isFetching, setOsmDataBusy],
  )

  useEffect(
    function publishOsmStorageReady() {
      setOsmStorageReady(storageReady)
    },
    [storageReady, setOsmStorageReady],
  )

  async function loadCoverageNow(
    map: MapLibreMap,
    options?: { force?: boolean; clearPersistedOnForce?: boolean },
  ) {
    if (!storageReady) return
    const args = scheduleCoverageFromMap(map)
    await loadOsmData(args.bounds, args.zoom, {
      mapSizePx: args.mapSizePx,
      force: options?.force,
      clearPersistedOnForce: options?.clearPersistedOnForce,
    })
  }

  return {
    loadCoverageNow,
    isFetching,
  }
}
