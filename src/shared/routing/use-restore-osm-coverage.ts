import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useState } from 'react'
import { pruneExpiredOsmCoverageSessions } from '@/shared/routing/osm-coverage-idb'
import { useOsmPreferFresh } from '@/shared/routing/osm-coverage-prefs-store'
import { restoreOsmCoverageSession } from '@/shared/routing/osm-coverage-query'

/**
 * Hydrate the OSM coverage TanStack Query session from IndexedDB once on boot.
 * Coverage fetches should wait until `ready` is true.
 */
export function useRestoreOsmCoverage() {
  const queryClient = useQueryClient()
  const preferFresh = useOsmPreferFresh()
  const [ready, setReady] = useState(false)

  const restore = useEffectEvent(async (): Promise<boolean> => {
    await pruneExpiredOsmCoverageSessions()
    if (!preferFresh) {
      await restoreOsmCoverageSession(queryClient, {})
    }
    return true
  })

  useEffect(
    function restoreOsmCoverageFromIdb() {
      let ignore = false
      setReady(false)

      void restore().then(() => {
        if (!ignore) setReady(true)
      })

      return function cancelRestoreOsmCoverageFromIdb() {
        ignore = true
      }
    },
    [preferFresh],
  )

  return ready
}
