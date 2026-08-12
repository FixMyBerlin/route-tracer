import { useEffect, useEffectEvent } from 'react'
import { isEditableTarget } from '@/shared/reference-image/is-editable-target'
import { isImageFile } from '@/shared/reference-image/load-image-file'
import { useReferenceImageActions } from '@/shared/reference-image/reference-image-store'

type UseReferenceImageInputOptions = {
  /** When false, paste and drop handlers no-op (tracing / export steps). */
  enabled?: boolean
}

export function useReferenceImageInput(options: UseReferenceImageInputOptions = {}) {
  const enabled = options.enabled ?? true
  const { setImageFile } = useReferenceImageActions()

  const onPasteImageFile = useEffectEvent(async (file: File) => {
    if (!enabled) return false
    if (!isImageFile(file)) return false
    return setImageFile(file)
  })

  async function handleImageFile(file: File) {
    if (!enabled) return false
    if (!isImageFile(file)) return false
    return setImageFile(file)
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
