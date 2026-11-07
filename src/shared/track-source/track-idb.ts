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
  /** Review places the user marked as right. Missing in records saved before this existed. */
  acceptedReviewIds?: string[]
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

/** The accepted review ids stored with a track; old records have none. */
export function acceptedReviewIdsOf(record: TrackRecord): string[] {
  const ids = record.acceptedReviewIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

/** Keeps the record's createdAt, so saving review marks does not extend how long it lasts. */
export async function putAcceptedReviewIds(id: string, acceptedReviewIds: string[]) {
  const record = await getTrack(id)
  if (!record) return
  await putTrack({ ...record, acceptedReviewIds })
}
