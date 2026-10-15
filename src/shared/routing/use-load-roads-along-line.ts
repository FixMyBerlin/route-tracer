import type { Position } from 'geojson'
import { useState } from 'react'
import { chunkLineBounds, type LineChunk } from '@/shared/routing/chunk-line-bounds'
import { coverageContainsPoint } from '@/shared/routing/coverage-contains-point'
import { useOsmCoverageFetch, useOsmCoverageQuery } from '@/shared/routing/osm-coverage-query'

/** Requests are sized in geography, not pixels; any zoom above the minimum works the same. */
const CHUNK_FETCH_ZOOM = 16
const CHUNK_FETCH_SIZE_PX = { width: 1024, height: 1024 }

/**
 * Roads along a line (a saved route, an uploaded track), loaded as a row of small boxes.
 * Boxes whose part of the line is already covered are skipped, so this only asks Overpass for
 * what is missing.
 */
export function useLoadRoadsAlongLine(
  line: Position[],
  { bufferMeters }: { bufferMeters?: number } = {},
) {
  const coverage = useOsmCoverageQuery({ select: (data) => data.coverage })
  const { loadOsmData, error } = useOsmCoverageFetch()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const missingChunks = (chunks: LineChunk[]) =>
    chunks.filter(
      (chunk) =>
        !chunk.positions.every(([lon = 0, lat = 0]) =>
          coverageContainsPoint(coverage.data, lon, lat),
        ),
    )

  const missing = line.length > 0 ? missingChunks(chunkLineBounds(line, { bufferMeters })) : []

  async function load() {
    const queue = missing
    if (queue.length === 0) return
    setProgress({ done: 0, total: queue.length })
    // `loadOsmData` reports failures instead of throwing.
    for (const [index, chunk] of queue.entries()) {
      const ok = await loadOsmData({
        bounds: chunk.bounds,
        zoom: CHUNK_FETCH_ZOOM,
        mapSizePx: CHUNK_FETCH_SIZE_PX,
      })
      // Stop on the first failure instead of hammering a busy server with the rest.
      if (!ok) break
      setProgress({ done: index + 1, total: queue.length })
    }
    setProgress(null)
  }

  return {
    /** Boxes still to load; each one is a request to the community server. */
    missingCount: missing.length,
    loading: progress != null,
    progress,
    error,
    load,
  }
}
