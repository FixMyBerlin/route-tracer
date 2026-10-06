import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useMapChromeActions } from '@/shared/map/map-chrome-store'
import { pruneExpiredOsmCoverageSessions } from '@/shared/routing/osm-coverage-idb'
import { restoreOsmCoverageSession } from '@/shared/routing/osm-coverage-query'

/**
 * Hydrate the OSM coverage TanStack Query session from IndexedDB once on boot.
 * Coverage fetches wait for `useOsmStorageReady()`, which also turns true when there is
 * nothing to restore or IndexedDB is unavailable.
 */
export function useRestoreOsmCoverage() {
  const queryClient = useQueryClient()
  const { markOsmStorageReady } = useMapChromeActions()

  useEffect(
    function restoreOsmCoverageFromIdb() {
      async function restore() {
        await pruneExpiredOsmCoverageSessions()
        await restoreOsmCoverageSession(queryClient, {})
      }

      void restore()
        .catch((error: unknown) => {
          console.error('Could not restore cached OSM data', error)
        })
        .finally(markOsmStorageReady)
    },
    [queryClient, markOsmStorageReady],
  )
}
