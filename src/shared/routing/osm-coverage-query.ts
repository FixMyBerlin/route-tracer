import { createOsmCoverageApi } from '@osm-editor-kit/osm-coverage'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { viewMinZoom } from '@/shared/routing/constants'
import { downloadOsmXmlCoverage } from '@/shared/routing/osm-xml'
import { buildHighwaysOverpassUrl } from '@/shared/routing/overpass-highways'

const osmCoverageApi = createOsmCoverageApi({
  getSessionKey: () => ['route-tracer-osm'] as const,
  minZoom: viewMinZoom,
  getDownloadUrl: (bounds) => buildHighwaysOverpassUrl(bounds),
  download: downloadOsmXmlCoverage,
  isNetworkEnabled: () => true,
})

export type OsmCoverageQueryData = ReturnType<typeof osmCoverageApi.emptyData>

export const osmCoverageSessionKey = osmCoverageApi.sessionKey
export const emptyOsmCoverageData = osmCoverageApi.emptyData
export const ensureOsmCoverage = osmCoverageApi.ensureCoverage
export const useOsmCoverageQuery = osmCoverageApi.createUseQuery(() => ({}))
export const useIsOsmCoverageFetching = osmCoverageApi.createUseIsFetching(() => ({}))

export function useOsmCoverageFetch() {
  const queryClient = useQueryClient()
  const isFetching = useIsOsmCoverageFetching()

  const loadOsmData = useCallback(
    async (
      bounds: Parameters<typeof ensureOsmCoverage>[1]['bounds'],
      zoom: number,
      options?: { force?: boolean; mapSizePx?: { width: number; height: number } },
    ) => {
      if (zoom < viewMinZoom) return

      const mapSizePx = options?.mapSizePx ?? { width: 1024, height: 768 }

      try {
        await ensureOsmCoverage(queryClient, {
          bounds,
          zoom,
          mapSizePx,
          force: options?.force,
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
    },
    [queryClient],
  )

  return {
    loadOsmData,
    isFetching,
  }
}
