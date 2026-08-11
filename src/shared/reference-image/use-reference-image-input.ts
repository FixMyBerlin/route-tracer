import { useCallback, useEffect } from 'react'
import { isEditableTarget } from '@/shared/reference-image/is-editable-target'
import { isImageFile } from '@/shared/reference-image/load-image-file'
import { useReferenceImageActions } from '@/shared/reference-image/reference-image-store'

export function useReferenceImageInput() {
  const { setImageFile } = useReferenceImageActions()

  const handleImageFile = useCallback(
    async (file: File) => {
      if (!isImageFile(file)) return false
      return setImageFile(file)
    },
    [setImageFile],
  )

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return

      const items = event.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.kind !== 'file') continue
        const file = item.getAsFile()
        if (file && isImageFile(file)) {
          event.preventDefault()
          void handleImageFile(file)
          return
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handleImageFile])

  const handleMapDrop = useCallback(
    async (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault()
      const file = event.dataTransfer.files[0]
      if (file) await handleImageFile(file)
    },
    [handleImageFile],
  )

  const preventDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
  }, [])

  return {
    handleImageFile,
    handleMapDrop,
    preventDragOver,
  }
}
