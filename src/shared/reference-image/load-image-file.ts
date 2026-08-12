const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export function isImageFile(file: File): boolean {
  if (file.type && IMAGE_TYPES.has(file.type)) return true
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name)
}

export async function loadImageBlob(blob: Blob): Promise<{
  bitmap: ImageBitmap
  objectUrl: string
  width: number
  height: number
}> {
  const bitmap = await createImageBitmap(blob)
  const objectUrl = URL.createObjectURL(blob)
  return {
    bitmap,
    objectUrl,
    width: bitmap.width,
    height: bitmap.height,
  }
}

export async function loadImageFile(file: File) {
  return loadImageBlob(file)
}
