import { create } from 'zustand'
import { isImageFile, loadImageFile } from './load-image-file'

interface ReferenceImageStore {
  imageBitmap: ImageBitmap | null
  objectUrl: string | null
  width: number
  height: number
  locked: boolean
  actions: {
    setImageFile: (file: File) => Promise<boolean>
    clearImage: () => void
    setLocked: (locked: boolean) => void
  }
}

const useReferenceImageStore = create<ReferenceImageStore>()((set, get) => ({
  imageBitmap: null,
  objectUrl: null,
  width: 0,
  height: 0,
  locked: false,
  actions: {
    setImageFile: async (file) => {
      if (!isImageFile(file)) return false

      const previous = get()
      if (previous.objectUrl) URL.revokeObjectURL(previous.objectUrl)
      previous.imageBitmap?.close()

      try {
        const loaded = await loadImageFile(file)
        set({
          imageBitmap: loaded.bitmap,
          objectUrl: loaded.objectUrl,
          width: loaded.width,
          height: loaded.height,
          locked: false,
        })
        return true
      } catch {
        return false
      }
    },
    clearImage: () => {
      const { objectUrl, imageBitmap } = get()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      imageBitmap?.close()
      set({
        imageBitmap: null,
        objectUrl: null,
        width: 0,
        height: 0,
        locked: false,
      })
    },
    setLocked: (locked) => set({ locked }),
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

export const useReferenceImageActions = () => useReferenceImageStore((state) => state.actions)
