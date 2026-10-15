import type { Position } from 'geojson'
import { pathLengthMeters } from '@/shared/routing/haversine'
import { joinTrackParts } from '@/shared/track-source/join-track-parts'
import { parseTrackText } from '@/shared/track-source/parse-track-file'

export type LoadedTrack = {
  id: string
  fileName: string
  name: string
  /** Continuous parts after joining the ones that touch; jumps lie between them. */
  parts: Position[][]
  /** All parts end to end, as one line (for drawing and comparing). */
  line: Position[]
  lengthMeters: number
}

/** Parse a stored or freshly dropped file. Throws `TrackParseError` with a message to show. */
export function loadTrackText(id: string, fileName: string, text: string): LoadedTrack {
  const parsed = parseTrackText(text, fileName)
  const joined = joinTrackParts(parsed.parts)
  const parts: Position[][] = []
  let start = 0
  for (const [lastOfPart] of joined.gaps) {
    parts.push(joined.coordinates.slice(start, lastOfPart + 1))
    start = lastOfPart + 1
  }
  parts.push(joined.coordinates.slice(start))

  return {
    id,
    fileName,
    name: parsed.name ?? fileName.replace(/\.[^.]+$/, ''),
    parts,
    line: joined.coordinates,
    lengthMeters: parts.reduce((sum, part) => sum + pathLengthMeters(part), 0),
  }
}
