import type { Map as MaplibreMap } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { ImageOverlayController } from '@/shared/reference-image/image-overlay-controller'

describe('ImageOverlayController', () => {
  it('unmount tolerates a map that already lost its style', () => {
    const map = {
      getStyle: () => undefined,
      on: () => map,
      off: () => map,
    } as unknown as MaplibreMap

    const controller = new ImageOverlayController(map)

    expect(() => controller.destroy()).not.toThrow()
  })
})
