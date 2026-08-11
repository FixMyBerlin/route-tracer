import { useAsyncDebouncer } from '@tanstack/react-pacer'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useEffectEvent } from 'react'
import { useMapChromeActions, useMapChromeOsmBusy } from '@/shared/map/map-chrome-store'
import { coverageFetchDebounceMs, viewMinZoom } from '@/shared/routing/constants'
import { scheduleCoverageFromMap, type CoverageFetchArgs } from '@/shared/routing/map-helpers'
import { useOsmCoverageFetch } from '@/shared/routing/osm-coverage-query'

export function useRouteCoveragePace() {
  const { loadOsmData, isFetching } = useOsmCoverageFetch()
  const { setOsmDataBusy } = useMapChromeActions()
  const osmBusy = useMapChromeOsmBusy()

  const runCoverageCheck = useEffectEvent(async (args: CoverageFetchArgs) => {
    await loadOsmData(args.bounds, args.zoom, { mapSizePx: args.mapSizePx })
  })

  const coverageDebouncer = useAsyncDebouncer(
    async (args: CoverageFetchArgs) => runCoverageCheck(args),
    { wait: coverageFetchDebounceMs },
    (state) => ({
      isPending: state.isPending,
      isExecuting: state.isExecuting,
    }),
  )

  const isPending = coverageDebouncer.state.isPending === true
  const isExecuting = coverageDebouncer.state.isExecuting === true
  const isBusy = isPending || isExecuting || isFetching

  useEffect(
    function publishOsmCoverageBusy() {
      setOsmDataBusy(isBusy)
    },
    [isBusy, setOsmDataBusy],
  )

  const scheduleCoverageCheck = useEffectEvent((map: MapLibreMap) => {
    const zoom = map.getZoom()
    if (zoom < viewMinZoom) {
      coverageDebouncer.cancel()
      return
    }

    void coverageDebouncer.maybeExecute(scheduleCoverageFromMap(map))
  })

  const loadCoverageNow = useEffectEvent(async (map: MapLibreMap) => {
    coverageDebouncer.cancel()
    const args = scheduleCoverageFromMap(map)
    await loadOsmData(args.bounds, args.zoom, { mapSizePx: args.mapSizePx })
  })

  return {
    scheduleCoverageCheck,
    loadCoverageNow,
    isFetching: isExecuting || isFetching,
    isBusy: osmBusy,
  }
}
