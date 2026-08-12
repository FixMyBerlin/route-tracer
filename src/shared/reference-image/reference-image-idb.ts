/** Same-origin restore for reference-image bytes. Not shareable across devices. */

const DB_NAME = 'route-tracer-reference-images'
const DB_VERSION = 1
const STORE_NAME = 'images'

/** Max age before prune removes a stored image (≈ 3 months). */
export const REFERENCE_IMAGE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export type ReferenceImageRecord = {
  id: string
  blob: Blob
  mimeType: string
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    request.onsuccess = () => resolve(request.result)
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export async function putReferenceImage(record: ReferenceImageRecord): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

export async function getReferenceImage(id: string): Promise<ReferenceImageRecord | undefined> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const result = await requestToPromise(
      tx.objectStore(STORE_NAME).get(id) as IDBRequest<ReferenceImageRecord | undefined>,
    )
    await transactionDone(tx)
    return result
  } finally {
    db.close()
  }
}

export async function deleteReferenceImage(id: string): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

/** Remove records older than {@link REFERENCE_IMAGE_TTL_MS}. */
export async function pruneExpiredReferenceImages(now = Date.now()): Promise<number> {
  const cutoff = now - REFERENCE_IMAGE_TTL_MS
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const all = await requestToPromise(store.getAll() as IDBRequest<ReferenceImageRecord[]>)
    let removed = 0
    for (const record of all) {
      if (record.createdAt < cutoff) {
        store.delete(record.id)
        removed += 1
      }
    }
    await transactionDone(tx)
    return removed
  } finally {
    db.close()
  }
}
