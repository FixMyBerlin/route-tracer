import type { OsmCoveragePersisted, OsmCoverageStorage } from '@osm-editor-kit/osm-coverage'

/** Same-origin durable OSM coverage session. Not shareable across devices. */

const DB_NAME = 'route-tracer-osm-coverage'
const DB_VERSION = 1
const STORE_NAME = 'sessions'

/** Max age before prune removes a stored session (≈ 14 days). */
const OSM_COVERAGE_TTL_MS = 14 * 24 * 60 * 60 * 1000

type OsmCoverageRecord = {
  key: string
  data: OsmCoveragePersisted
  updatedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
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

function sessionKeyToStorageKey(sessionKey: readonly unknown[]): string {
  return JSON.stringify(sessionKey)
}

async function putOsmCoverageSession(
  sessionKey: readonly unknown[],
  data: OsmCoveragePersisted,
): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const record: OsmCoverageRecord = {
      key: sessionKeyToStorageKey(sessionKey),
      data,
      updatedAt: Date.now(),
    }
    tx.objectStore(STORE_NAME).put(record)
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

async function getOsmCoverageSession(
  sessionKey: readonly unknown[],
): Promise<OsmCoveragePersisted | null> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const result = await requestToPromise(
      tx.objectStore(STORE_NAME).get(sessionKeyToStorageKey(sessionKey)) as IDBRequest<
        OsmCoverageRecord | undefined
      >,
    )
    await transactionDone(tx)
    if (!result) return null
    if (Date.now() - result.updatedAt > OSM_COVERAGE_TTL_MS) return null
    return result.data
  } finally {
    db.close()
  }
}

async function deleteOsmCoverageSession(sessionKey: readonly unknown[]): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(sessionKeyToStorageKey(sessionKey))
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

/** Remove records older than the coverage TTL. */
export async function pruneExpiredOsmCoverageSessions(now = Date.now()): Promise<number> {
  const cutoff = now - OSM_COVERAGE_TTL_MS
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const all = await requestToPromise(store.getAll() as IDBRequest<OsmCoverageRecord[]>)
    let removed = 0
    for (const record of all) {
      if (record.updatedAt < cutoff) {
        store.delete(record.key)
        removed += 1
      }
    }
    await transactionDone(tx)
    return removed
  } finally {
    db.close()
  }
}

export function createOsmCoverageIdbStorage(): OsmCoverageStorage {
  return {
    load: getOsmCoverageSession,
    save: putOsmCoverageSession,
    clear: deleteOsmCoverageSession,
  }
}
