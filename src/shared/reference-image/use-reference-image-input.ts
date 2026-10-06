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
  /** When false, paste and drop are ignored (tracing / export steps). */
  enabled: boolean
}

export function useReferenceImageInput({ enabled }: UseReferenceImageInputOptions) {
  const { setImageBlob } = useReferenceImageActions()
  const { updateSearch } = useIndexSearchNavigation()
  const imageId = Route.useSearch({ select: (search) => search.imageId })

  async function handleImageFile(file: File) {
    if (!enabled || !isImageFile(file)) return false
    if (!(await setImageBlob(file))) return false

    const previousImageId = imageId
    const nextId = crypto.randomUUID()
    try {
      await putReferenceImage({
        id: nextId,
        blob: file,
        mimeType: file.type || 'application/octet-stream',
        createdAt: Date.now(),
      })
      updateSearch({ imageId: nextId })
      // Housekeeping only once the URL points at the new record.
      if (previousImageId) await deleteReferenceImage(previousImageId)
      await pruneExpiredReferenceImages()
    } catch {
      // Image is still in memory; URL restore may fail until the next successful persist.
    }
    return true
  }

  const onPasteImageFile = useEffectEvent(handleImageFile)

  useEffect(
    function subscribeToWindowPaste() {
      if (!enabled) return

      const handlePaste = (event: ClipboardEvent) => {
        if (isEditableTarget(event.target)) return

        for (const item of event.clipboardData?.items ?? []) {
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

  /** Always claims the drop, so a stray file never navigates the browser away from the app. */
  async function handleMapDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) await handleImageFile(file)
  }

  function preventDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
  }

  return { handleImageFile, handleMapDrop, preventDragOver }
}
