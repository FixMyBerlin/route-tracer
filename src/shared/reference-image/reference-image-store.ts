import { create } from 'zustand'
import { isImageFile, loadImageBlob, loadImageFile } from './load-image-file'

export type ReferenceImageRestoreStatus = 'idle' | 'pending' | 'ready' | 'missing'

interface ReferenceImageStore {
  imageBitmap: ImageBitmap | null
  objectUrl: string | null
  width: number
  height: number
  locked: boolean
  restoreStatus: ReferenceImageRestoreStatus
  actions: {
    setImageFile: (file: File) => Promise<boolean>
    setImageBlob: (blob: Blob) => Promise<boolean>
    clearImage: () => void
    setLocked: (locked: boolean) => void
    setRestoreStatus: (restoreStatus: ReferenceImageRestoreStatus) => void
  }
}

function revokeCurrentImage(state: Pick<ReferenceImageStore, 'objectUrl' | 'imageBitmap'>) {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl)
  state.imageBitmap?.close()
}

const useReferenceImageStore = create<ReferenceImageStore>()((set, get) => ({
  imageBitmap: null,
  objectUrl: null,
  width: 0,
  height: 0,
  locked: false,
  restoreStatus: 'idle',
  actions: {
    setImageFile: async (file) => {
      if (!isImageFile(file)) return false

      revokeCurrentImage(get())

      try {
        const loaded = await loadImageFile(file)
        set({
          imageBitmap: loaded.bitmap,
          objectUrl: loaded.objectUrl,
          width: loaded.width,
          height: loaded.height,
          locked: false,
          restoreStatus: 'ready',
        })
        return true
      } catch {
        return false
      }
    },
    setImageBlob: async (blob) => {
      revokeCurrentImage(get())

      try {
        const loaded = await loadImageBlob(blob)
        set({
          imageBitmap: loaded.bitmap,
          objectUrl: loaded.objectUrl,
          width: loaded.width,
          height: loaded.height,
          locked: false,
          restoreStatus: 'ready',
        })
        return true
      } catch {
        return false
      }
    },
    clearImage: () => {
      revokeCurrentImage(get())
      set({
        imageBitmap: null,
        objectUrl: null,
        width: 0,
        height: 0,
        locked: false,
        restoreStatus: 'idle',
      })
    },
    setLocked: (locked) => set({ locked }),
    setRestoreStatus: (restoreStatus) => set({ restoreStatus }),
  },
}))

export const useReferenceImageBitmap = () => useReferenceImageStore((state) => state.imageBitmap)

export const useReferenceImageObjectUrl = () => useReferenceImageStore((state) => state.objectUrl)

export const useReferenceImageAspectRatio = () => {
  const width = useReferenceImageStore((state) => state.width)
  const height = useReferenceImageStore((state) => state.height)
  return height > 0 ? width / height : 1
}

export const useHasReferenceImage = () =>
  useReferenceImageStore((state) => state.imageBitmap !== null)

export const useReferenceImageLocked = () => useReferenceImageStore((state) => state.locked)

export const useReferenceImageRestoreStatus = () =>
  useReferenceImageStore((state) => state.restoreStatus)

export const useReferenceImageActions = () => useReferenceImageStore((state) => state.actions)
