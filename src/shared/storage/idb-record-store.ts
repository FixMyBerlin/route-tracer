/** One IndexedDB object store of `{ id, createdAt }` records that expire after `ttlMs`. */
export type IdbRecord = { id: string; createdAt: number }

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

export function createIdbRecordStore<T extends IdbRecord>({
  dbName,
  storeName,
  ttlMs,
}: {
  dbName: string
  storeName: string
  ttlMs: number
}) {
  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    })
  }

  async function withStore<R>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<R> | R,
  ): Promise<R> {
    const db = await openDb()
    try {
      const tx = db.transaction(storeName, mode)
      const result = await run(tx.objectStore(storeName))
      await transactionDone(tx)
      return result
    } finally {
      db.close()
    }
  }

  return {
    put: (record: T) => withStore('readwrite', (store) => void store.put(record)),
    get: (id: string) =>
      withStore('readonly', (store) =>
        requestToPromise(store.get(id) as IDBRequest<T | undefined>),
      ),
    delete: (id: string) => withStore('readwrite', (store) => void store.delete(id)),
    /** Remove records older than `ttlMs`; resolves to how many went. */
    pruneExpired: (now = Date.now()) =>
      withStore('readwrite', async (store) => {
        const all = await requestToPromise(store.getAll() as IDBRequest<T[]>)
        const expired = all.filter((record) => record.createdAt < now - ttlMs)
        for (const record of expired) store.delete(record.id)
        return expired.length
      }),
  }
}
