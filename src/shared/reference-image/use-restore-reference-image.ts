import { useEffect, useEffectEvent } from 'react'
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
 * Sets restoreStatus to `missing` when the record is absent or expired.
 */
export function useRestoreReferenceImage() {
  const imageId = Route.useSearch({ select: (search) => search.imageId })
  const hasImage = useHasReferenceImage()
  const { setImageBlob, setRestoreStatus } = useReferenceImageActions()

  const restoreFromIdb = useEffectEvent(async (id: string) => {
    await pruneExpiredReferenceImages()
    const record = await getReferenceImage(id)
    if (!record) {
      setRestoreStatus('missing')
      return false
    }
    const ok = await setImageBlob(record.blob)
    if (!ok) setRestoreStatus('missing')
    return ok
  })

  useEffect(
    function restoreReferenceImageFromIdb() {
      if (!imageId) {
        if (!hasImage) setRestoreStatus('idle')
        return
      }

      if (hasImage) {
        setRestoreStatus('ready')
        return
      }

      let ignore = false
      setRestoreStatus('pending')

      void restoreFromIdb(imageId).then((ok) => {
        if (ignore) return
        if (!ok) setRestoreStatus('missing')
      })

      return function cancelRestoreReferenceImageFromIdb() {
        ignore = true
      }
    },
    [imageId, hasImage, setRestoreStatus],
  )
}
