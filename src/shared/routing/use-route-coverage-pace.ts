import { useAsyncDebouncer } from '@tanstack/react-pacer'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useMapChromeActions, useMapChromeOsmBusy } from '@/shared/map/map-chrome-store'
import { coverageFetchDebounceMs, viewMinZoom } from '@/shared/routing/constants'
import { scheduleCoverageFromMap, type CoverageFetchArgs } from '@/shared/routing/map-helpers'
import { useOsmCoverageFetch } from '@/shared/routing/osm-coverage-query'
import { useRestoreOsmCoverage } from '@/shared/routing/use-restore-osm-coverage'

export function useRouteCoveragePace(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true
  const storageReady = useRestoreOsmCoverage()
  const enabledRef = useRef(enabled)
  const storageReadyRef = useRef(storageReady)
  enabledRef.current = enabled
  storageReadyRef.current = storageReady

  const { loadOsmData, isFetching } = useOsmCoverageFetch()
  const { setOsmDataBusy } = useMapChromeActions()
  const osmBusy = useMapChromeOsmBusy()

  const coverageDebouncer = useAsyncDebouncer(
    async (args: CoverageFetchArgs) => {
      if (!enabledRef.current || !storageReadyRef.current) return
      await loadOsmData(args.bounds, args.zoom, { mapSizePx: args.mapSizePx })
    },
    { wait: coverageFetchDebounceMs },
    (state) => ({
      isPending: state.isPending,
      isExecuting: state.isExecuting,
    }),
  )

  const isPending = coverageDebouncer.state.isPending === true
  const isExecuting = coverageDebouncer.state.isExecuting === true
  const isBusy = enabled && (isPending || isExecuting || isFetching)

  useEffect(
    function publishOsmCoverageBusy() {
      setOsmDataBusy(isBusy)
    },
    [isBusy, setOsmDataBusy],
  )

  const cancelDebouncer = useEffectEvent(() => {
    coverageDebouncer.cancel()
  })

  useEffect(
    function cancelCoverageWhenDisabled() {
      if (enabled) return
      cancelDebouncer()
    },
    [enabled],
  )

  // Plain functions for Map event handlers / sibling kicks — not useEffectEvent
  // (Effect Events must not be passed as props or used as DOM/map handlers).
  function scheduleCoverageCheck(map: MapLibreMap) {
    if (!enabledRef.current || !storageReadyRef.current) {
      coverageDebouncer.cancel()
      return
    }

    const zoom = map.getZoom()
    if (zoom < viewMinZoom) {
      coverageDebouncer.cancel()
      return
    }

    void coverageDebouncer.maybeExecute(scheduleCoverageFromMap(map))
  }

  async function loadCoverageNow(
    map: MapLibreMap,
    options?: { force?: boolean; clearPersistedOnForce?: boolean },
  ) {
    if (!enabledRef.current || !storageReadyRef.current) return
    coverageDebouncer.cancel()
    const args = scheduleCoverageFromMap(map)
    await loadOsmData(args.bounds, args.zoom, {
      mapSizePx: args.mapSizePx,
      force: options?.force,
      clearPersistedOnForce: options?.clearPersistedOnForce,
    })
  }

  return {
    scheduleCoverageCheck,
    loadCoverageNow,
    storageReady,
    isFetching: enabled && (isExecuting || isFetching),
    isBusy: osmBusy,
  }
}
