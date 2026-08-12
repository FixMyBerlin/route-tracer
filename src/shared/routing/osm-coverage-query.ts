import { createOsmCoverageApi, type OsmCoverageStorage } from '@osm-editor-kit/osm-coverage'
import { useQueryClient } from '@tanstack/react-query'
import { viewMinZoom } from '@/shared/routing/constants'
import { createOsmCoverageIdbStorage } from '@/shared/routing/osm-coverage-idb'
import { getOsmPreferFresh, useOsmPreferFresh } from '@/shared/routing/osm-coverage-prefs-store'
import { downloadOsmXmlCoverage } from '@/shared/routing/osm-xml'
import { buildHighwaysOverpassUrl } from '@/shared/routing/overpass-highways'

function createPreferFreshAwareStorage(base: OsmCoverageStorage): OsmCoverageStorage {
  return {
    load: async (sessionKey) => {
      if (getOsmPreferFresh()) return null
      return base.load(sessionKey)
    },
    save: async (sessionKey, data) => {
      if (getOsmPreferFresh()) return
      await base.save(sessionKey, data)
    },
    clear: (sessionKey) => base.clear(sessionKey),
  }
}

const osmCoverageApi = createOsmCoverageApi({
  getSessionKey: () => ['route-tracer-osm'] as const,
  minZoom: viewMinZoom,
  getDownloadUrl: (bounds) => buildHighwaysOverpassUrl(bounds),
  download: downloadOsmXmlCoverage,
  isNetworkEnabled: () => true,
  storage: createPreferFreshAwareStorage(createOsmCoverageIdbStorage()),
})

export type OsmCoverageQueryData = ReturnType<typeof osmCoverageApi.emptyData>

export const osmCoverageSessionKey = osmCoverageApi.sessionKey
export const emptyOsmCoverageData = osmCoverageApi.emptyData
export const ensureOsmCoverage = osmCoverageApi.ensureCoverage
export const restoreOsmCoverageSession = osmCoverageApi.restoreSession
export const clearPersistedOsmCoverage = osmCoverageApi.clearPersisted
export const useOsmCoverageQuery = osmCoverageApi.createUseQuery(() => ({}))
export const useIsOsmCoverageFetching = osmCoverageApi.createUseIsFetching(() => ({}))

export function useOsmCoverageFetch() {
  const queryClient = useQueryClient()
  const isFetching = useIsOsmCoverageFetching()
  const preferFresh = useOsmPreferFresh()

  async function loadOsmData(
    bounds: Parameters<typeof ensureOsmCoverage>[1]['bounds'],
    zoom: number,
    options?: {
      force?: boolean
      mapSizePx?: { width: number; height: number }
      clearPersistedOnForce?: boolean
    },
  ) {
    if (zoom < viewMinZoom) return

    const mapSizePx = options?.mapSizePx ?? { width: 1024, height: 768 }
    const force = options?.force === true

    try {
      await ensureOsmCoverage(queryClient, {
        bounds,
        zoom,
        mapSizePx,
        force,
        skipRestore: preferFresh,
        clearPersistedOnForce: options?.clearPersistedOnForce === true,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(
        message === 'Request failed with status code 429'
          ? 'Too many OSM requests — try again soon'
          : message,
        error,
      )
    }
  }

  return {
    loadOsmData,
    isFetching,
  }
}
