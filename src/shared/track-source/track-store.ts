import { create } from 'zustand'
import type { LoadedTrack } from '@/shared/track-source/loaded-track'

type TrackRestoreStatus = 'idle' | 'pending' | 'ready' | 'missing'

type TrackStore = {
  track: LoadedTrack | null
  restoreStatus: TrackRestoreStatus
  /** Message for the last file that could not be read. */
  error: string | null
  /** Review items the user marked as fine, by id. Also stored with the track in IndexedDB. */
  acceptedReviewIds: string[]
  actions: {
    setTrack: (track: LoadedTrack, acceptedReviewIds?: string[]) => void
    clearTrack: () => void
    setRestoreStatus: (status: TrackRestoreStatus) => void
    setError: (error: string | null) => void
    acceptReview: (id: string) => void
    setAcceptedReviewIds: (ids: string[]) => void
  }
}

const useTrackStore = create<TrackStore>((set) => ({
  track: null,
  restoreStatus: 'idle',
  error: null,
  acceptedReviewIds: [],
  actions: {
    setTrack: (track, acceptedReviewIds = []) =>
      set({ track, restoreStatus: 'ready', error: null, acceptedReviewIds }),
    clearTrack: () =>
      set({ track: null, restoreStatus: 'idle', error: null, acceptedReviewIds: [] }),
    setRestoreStatus: (restoreStatus) => set({ restoreStatus }),
    setError: (error) => set({ error }),
    acceptReview: (id) =>
      set((state) =>
        state.acceptedReviewIds.includes(id)
          ? state
          : { acceptedReviewIds: [...state.acceptedReviewIds, id] },
      ),
    setAcceptedReviewIds: (acceptedReviewIds) => set({ acceptedReviewIds }),
  },
}))

export const useTrack = () => useTrackStore((state) => state.track)
export const useTrackRestoreStatus = () => useTrackStore((state) => state.restoreStatus)
export const useTrackError = () => useTrackStore((state) => state.error)
export const useAcceptedReviewIds = () => useTrackStore((state) => state.acceptedReviewIds)
export const useTrackActions = () => useTrackStore((state) => state.actions)

/** Read outside React (the review actions save the marks with the stored track). */
export function getTrackState() {
  return useTrackStore.getState()
}
