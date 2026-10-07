import { createOsmCoverageApi } from '@osm-editor-kit/osm-coverage'
import { useQueryClient } from '@tanstack/react-query'
import { useMapChromeActions, useOsmLoadError } from '@/shared/map/map-chrome-store'
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
  const status = Number(/status code (\d{3})$/.exec(message)?.[1])
  if (status === 429) return 'Too many requests to the OSM server. Please wait a minute.'
  if (status >= 500)
    return `The OSM server is busy right now (${status}). Please try again in a moment.`
  return message
}

/**
 * Manual viewport load. `error` holds the message of the last failed load, shared by every
 * place that offers loading.
 */
export function useOsmCoverageFetch() {
  const queryClient = useQueryClient()
  const isFetching = useIsOsmCoverageFetching()
  const error = useOsmLoadError()
  const { setOsmLoadError } = useMapChromeActions()

  async function loadOsmData(
    args: CoverageFetchArgs,
    options?: { force?: boolean; clearPersistedOnForce?: boolean },
  ) {
    if (args.zoom < viewMinZoom) return

    setOsmLoadError(null)
    try {
      await osmCoverageApi.ensureCoverage(queryClient, {
        ...args,
        force: options?.force === true,
        clearPersistedOnForce: options?.clearPersistedOnForce === true,
      })
    } catch (error: unknown) {
      console.error(error)
      setOsmLoadError(describeLoadError(error))
    }
  }

  return { loadOsmData, isFetching, error }
}
