import { useEffect, useEffectEvent } from 'react'
import { Route } from '@/routes/index'
import { isEditableTarget } from '@/shared/reference-image/is-editable-target'
import { isImageFile } from '@/shared/reference-image/load-image-file'
import {
  deleteReferenceImage,
  pruneExpiredReferenceImages,
  putReferenceImage,
} from '@/shared/reference-image/reference-image-idb'
import { useReferenceImageActions } from '@/shared/reference-image/reference-image-store'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'

type UseReferenceImageInputOptions = {
  /** When false, paste and drop handlers no-op (tracing / export steps). */
  enabled?: boolean
}

export function useReferenceImageInput(options: UseReferenceImageInputOptions = {}) {
  const enabled = options.enabled ?? true
  const { setImageFile } = useReferenceImageActions()
  const { updateSearch } = useIndexSearchNavigation()
  const imageId = Route.useSearch({ select: (search) => search.imageId })

  const persistImageFile = useEffectEvent(
    async (file: File, previousImageId: string | undefined) => {
      const ok = await setImageFile(file)
      if (!ok) return false

      const nextId = crypto.randomUUID()
      try {
        await pruneExpiredReferenceImages()
        await putReferenceImage({
          id: nextId,
          blob: file,
          mimeType: file.type || 'application/octet-stream',
          createdAt: Date.now(),
        })
        if (previousImageId && previousImageId !== nextId) {
          await deleteReferenceImage(previousImageId)
        }
        updateSearch({ imageId: nextId })
      } catch {
        // Image is still in memory; URL restore may fail until the next successful persist.
      }
      return true
    },
  )

  const onPasteImageFile = useEffectEvent(async (file: File) => {
    if (!enabled) return false
    if (!isImageFile(file)) return false
    return persistImageFile(file, imageId)
  })

  async function handleImageFile(file: File) {
    if (!enabled) return false
    if (!isImageFile(file)) return false
    return persistImageFile(file, imageId)
  }

  useEffect(
    function subscribeToWindowPaste() {
      if (!enabled) return

      const handlePaste = (event: ClipboardEvent) => {
        if (isEditableTarget(event.target)) return

        const items = event.clipboardData?.items
        if (!items) return

        for (const item of items) {
          if (item.kind !== 'file') continue
          const file = item.getAsFile()
          if (file && isImageFile(file)) {
            event.preventDefault()
            void onPasteImageFile(file)
            return
          }
        }
      }

      window.addEventListener('paste', handlePaste)
      return function unsubscribeFromWindowPaste() {
        window.removeEventListener('paste', handlePaste)
      }
    },
    [enabled],
  )

  async function handleMapDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    if (!enabled) return
    const file = event.dataTransfer.files[0]
    if (file) await handleImageFile(file)
  }

  function preventDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
  }

  return {
    handleImageFile,
    handleMapDrop,
    preventDragOver,
  }
}
