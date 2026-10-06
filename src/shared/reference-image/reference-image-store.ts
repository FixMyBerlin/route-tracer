import { create } from 'zustand'
import { loadImageBlob } from './load-image-file'

type ReferenceImageRestoreStatus = 'idle' | 'pending' | 'ready' | 'missing'

interface ReferenceImageStore {
  objectUrl: string | null
  width: number
  height: number
  locked: boolean
  restoreStatus: ReferenceImageRestoreStatus
  actions: {
    /** Resolves `false` and keeps the current image when the blob cannot be decoded. */
    setImageBlob: (blob: Blob) => Promise<boolean>
    clearImage: () => void
    setLocked: (locked: boolean) => void
    setRestoreStatus: (restoreStatus: ReferenceImageRestoreStatus) => void
  }
}

const useReferenceImageStore = create<ReferenceImageStore>()((set, get) => ({
  objectUrl: null,
  width: 0,
  height: 0,
  locked: false,
  restoreStatus: 'idle',
  actions: {
    setImageBlob: async (blob) => {
      try {
        const loaded = await loadImageBlob(blob)
        // Release the previous image only now, so a failed load leaves it on the map.
        const previousUrl = get().objectUrl
        if (previousUrl) URL.revokeObjectURL(previousUrl)
        set({ ...loaded, locked: false, restoreStatus: 'ready' })
        return true
      } catch {
        return false
      }
    },
    clearImage: () => {
      const previousUrl = get().objectUrl
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      set({ objectUrl: null, width: 0, height: 0, locked: false, restoreStatus: 'idle' })
    },
    setLocked: (locked) => set({ locked }),
    setRestoreStatus: (restoreStatus) => set({ restoreStatus }),
  },
}))

export const useReferenceImageObjectUrl = () => useReferenceImageStore((state) => state.objectUrl)

export const useReferenceImageAspectRatio = () => {
  const width = useReferenceImageStore((state) => state.width)
  const height = useReferenceImageStore((state) => state.height)
  return height > 0 ? width / height : 1
}

export const useHasReferenceImage = () =>
  useReferenceImageStore((state) => state.objectUrl !== null)

export const useReferenceImageLocked = () => useReferenceImageStore((state) => state.locked)

export const useReferenceImageRestoreStatus = () =>
  useReferenceImageStore((state) => state.restoreStatus)

export const useReferenceImageActions = () => useReferenceImageStore((state) => state.actions)
