import { useEffect, useEffectEvent } from 'react'
import { Route } from '@/routes/index'
import { loadTrackText } from '@/shared/track-source/loaded-track'
import { getTrack, pruneExpiredTracks } from '@/shared/track-source/track-idb'
import { useTrack, useTrackActions } from '@/shared/track-source/track-store'

/**
 * When the URL has `trackId` and memory has no track, read the file back from IndexedDB.
 * Sets restoreStatus to `missing` when the record is gone (other browser, expired, cleared).
 */
export function useRestoreTrack() {
  const trackId = Route.useSearch({ select: (search) => search.trackId })
  const track = useTrack()
  const { setTrack, setRestoreStatus } = useTrackActions()
  // Read, not depended on: a freshly dropped track must not send this back to IndexedDB for
  // the one the URL still names until the new one is stored.
  const loadedTrackId = useEffectEvent(() => track?.id)

  useEffect(
    function restoreTrackFromIdb() {
      if (loadedTrackId() === trackId) return
      if (!trackId) {
        setRestoreStatus('idle')
        return
      }

      let ignore = false
      setRestoreStatus('pending')

      async function restore(id: string) {
        await pruneExpiredTracks()
        const record = await getTrack(id)
        if (ignore || !record) return false
        setTrack(loadTrackText(record.id, record.fileName, record.text))
        return true
      }

      void restore(trackId)
        // IndexedDB can be unavailable (private mode, blocked storage), or the file unreadable.
        .catch(() => false)
        .then((ok) => {
          if (!ignore && !ok) setRestoreStatus('missing')
        })

      return function cancelRestoreTrackFromIdb() {
        ignore = true
      }
    },
    [trackId, setTrack, setRestoreStatus],
  )
}
