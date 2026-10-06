import { createOsmCoverageApi } from '@osm-editor-kit/osm-coverage'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { viewMinZoom } from '@/shared/routing/constants'
import type { CoverageFetchArgs } from '@/shared/routing/map-helpers'
import { createOsmCoverageIdbStorage } from '@/shared/routing/osm-coverage-idb'
import { downloadOsmXmlCoverage } from '@/shared/routing/osm-xml'
import { buildHighwaysOverpassUrl } from '@/shared/routing/overpass-highways'

const osmCoverageApi = createOsmCoverageApi({
  getSessionKey: () => ['route-tracer-osm'] as const,
  minZoom: viewMinZoom,
  getDownloadUrl: (bounds) => buildHighwaysOverpassUrl(bounds),
  download: downloadOsmXmlCoverage,
  isNetworkEnabled: () => true,
  storage: createOsmCoverageIdbStorage(),
})

export const restoreOsmCoverageSession = osmCoverageApi.restoreSession
export const useOsmCoverageQuery = osmCoverageApi.createUseQuery(() => ({}))
export const useIsOsmCoverageFetching = osmCoverageApi.createUseIsFetching(() => ({}))

function describeLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  return message === 'Request failed with status code 429'
    ? 'Too many OSM requests — try again soon'
    : message
}

/** Manual viewport load. `error` holds the message of the last failed load. */
export function useOsmCoverageFetch() {
  const queryClient = useQueryClient()
  const isFetching = useIsOsmCoverageFetching()
  const [error, setError] = useState<string | null>(null)

  async function loadOsmData(
    args: CoverageFetchArgs,
    options?: { force?: boolean; clearPersistedOnForce?: boolean },
  ) {
    if (args.zoom < viewMinZoom) return

    setError(null)
    try {
      await osmCoverageApi.ensureCoverage(queryClient, {
        ...args,
        force: options?.force === true,
        clearPersistedOnForce: options?.clearPersistedOnForce === true,
      })
    } catch (error: unknown) {
      console.error(error)
      setError(describeLoadError(error))
    }
  }

  return { loadOsmData, isFetching, error }
}
