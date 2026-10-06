import { useEffect } from 'react'
import { Route } from '@/routes/index'
import {
  getReferenceImage,
  pruneExpiredReferenceImages,
} from '@/shared/reference-image/reference-image-idb'
import {
  useHasReferenceImage,
  useReferenceImageActions,
} from '@/shared/reference-image/reference-image-store'

/**
 * When the URL has `imageId` and memory has no image, load bytes from IndexedDB.
 * Sets restoreStatus to `missing` when the record is absent, expired, or unreadable.
 */
export function useRestoreReferenceImage() {
  const imageId = Route.useSearch({ select: (search) => search.imageId })
  const hasImage = useHasReferenceImage()
  const { setImageBlob, setRestoreStatus } = useReferenceImageActions()

  useEffect(
    function restoreReferenceImageFromIdb() {
      if (hasImage) return
      if (!imageId) {
        setRestoreStatus('idle')
        return
      }

      let ignore = false
      setRestoreStatus('pending')

      async function restore(id: string) {
        await pruneExpiredReferenceImages()
        const record = await getReferenceImage(id)
        if (ignore || !record) return false
        return setImageBlob(record.blob)
      }

      void restore(imageId)
        // IndexedDB can be unavailable (private mode, blocked storage).
        .catch(() => false)
        .then((ok) => {
          if (!ignore && !ok) setRestoreStatus('missing')
        })

      return function cancelRestoreReferenceImageFromIdb() {
        ignore = true
      }
    },
    [imageId, hasImage, setImageBlob, setRestoreStatus],
  )
}
