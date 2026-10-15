import { createIdbRecordStore } from '@/shared/storage/idb-record-store'

/**
 * The uploaded file exactly as it came, so the route can be matched again from it later.
 * Same browser only: a shared link carries the waypoints, not the track.
 */
type TrackRecord = {
  id: string
  fileName: string
  text: string
  createdAt: number
}

const tracks = createIdbRecordStore<TrackRecord>({
  dbName: 'route-tracer-tracks',
  storeName: 'tracks',
  // ≈ 3 months, like reference images
  ttlMs: 90 * 24 * 60 * 60 * 1000,
})

export const putTrack = tracks.put
export const getTrack = tracks.get
export const deleteTrack = tracks.delete
export const pruneExpiredTracks = tracks.pruneExpired
