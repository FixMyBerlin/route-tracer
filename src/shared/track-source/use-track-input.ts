import { useMap } from 'react-map-gl/maplibre'
import { Route } from '@/routes/index'
import { fitMapToLine } from '@/shared/map/fit-map-to-line'
import { readRouteExport } from '@/shared/routing/route-export'
import { useApplyRoute } from '@/shared/routing/use-apply-route'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { loadTrackText } from '@/shared/track-source/loaded-track'
import { TrackParseError } from '@/shared/track-source/parse-track-file'
import { deleteTrack, putTrack } from '@/shared/track-source/track-idb'
import { useTrackActions } from '@/shared/track-source/track-store'

/** Files over this size are not tracks we can handle in the browser (or meant to upload). */
const MAX_TRACK_BYTES = 20 * 1024 * 1024

export function isTrackFile(file: File) {
  return /\.(gpx|geojson|json)$/i.test(file.name) || /gpx|geo\+json|json/.test(file.type)
}

/**
 * Read, store and select an uploaded GPX/GeoJSON file, and show it on the map. Resolves to the
 * loaded track or null. Call inside the MapProvider.
 */
export function useTrackInput() {
  const { mainMap } = useMap()
  const { setTrack, setError } = useTrackActions()
  const { updateSearch } = useIndexSearchNavigation()
  const previousTrackId = Route.useSearch({ select: (search) => search.trackId })
  const applyRoute = useApplyRoute()

  async function handleTrackFile(file: File) {
    if (file.size > MAX_TRACK_BYTES) {
      setError('This file is too large for a single track.')
      return null
    }
    const fileText = await file.text()
    // A file this app exported: open its route as it was, instead of snapping it anew.
    const exported = readRouteExport(fileText)
    const text = exported?.track
      ? JSON.stringify({
          type: 'Feature',
          properties: { name: exported.track.name },
          geometry: { type: 'MultiLineString', coordinates: exported.track.parts },
        })
      : fileText
    if (exported && !exported.track) {
      applyRoute(exported.waypoints)
      return null
    }

    const id = crypto.randomUUID()
    let track
    try {
      track = loadTrackText(id, file.name, text)
    } catch (error) {
      setError(error instanceof TrackParseError ? error.message : 'This file could not be read.')
      return null
    }

    setTrack(track)
    fitMapToLine(mainMap?.getMap(), track.line)
    try {
      await putTrack({ id, fileName: file.name, text, createdAt: Date.now() })
      updateSearch({ trackId: id })
      if (previousTrackId) await deleteTrack(previousTrackId)
    } catch {
      // Keep using the track, but do not let the URL point at an older stored one, which would
      // be restored over it.
      updateSearch({ trackId: undefined })
      setError(
        'The track could not be saved in this browser. It is used now, but gone after a reload.',
      )
    }
    if (exported) applyRoute(exported.waypoints)
    return track
  }

  return { handleTrackFile }
}
