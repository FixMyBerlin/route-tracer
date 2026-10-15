import { createIdbRecordStore } from '@/shared/storage/idb-record-store'

/** Same-origin restore for reference-image bytes. Not shareable across devices. */

type ReferenceImageRecord = {
  id: string
  blob: Blob
  mimeType: string
  createdAt: number
}

const referenceImages = createIdbRecordStore<ReferenceImageRecord>({
  dbName: 'route-tracer-reference-images',
  storeName: 'images',
  // ≈ 3 months
  ttlMs: 90 * 24 * 60 * 60 * 1000,
})

export const putReferenceImage = referenceImages.put
export const getReferenceImage = referenceImages.get
export const deleteReferenceImage = referenceImages.delete
export const pruneExpiredReferenceImages = referenceImages.pruneExpired
