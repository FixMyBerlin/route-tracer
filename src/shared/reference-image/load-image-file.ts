const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_TYPES.has(file.type)) return true
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name)
}

/** Decodes the blob to prove it is an image and to read its size. Rejects when it is not. */
export async function loadImageBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const { width, height } = bitmap
  bitmap.close()
  return { objectUrl: URL.createObjectURL(blob), width, height }
}
