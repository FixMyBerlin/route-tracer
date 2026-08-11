import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { encodeOverlaySearch } from '@/shared/reference-image/overlay-search-codec'
import {
  useHasReferenceImage,
  useReferenceImageActions,
  useReferenceImageLocked,
} from '@/shared/reference-image/reference-image-store'
import { DEFAULT_OVERLAY_OPACITY } from '@/shared/reference-image/types'
import { serializeIndexSearch } from '@/shared/routing/search-schema'

type ReferenceImagePanelProps = {
  onImageFile: (file: File) => Promise<boolean>
}

export function ReferenceImagePanel({ onImageFile }: ReferenceImagePanelProps) {
  const navigate = useNavigate({ from: Route.fullPath })
  const overlay = Route.useSearch({ select: (search) => search.overlay })
  const hasImage = useHasReferenceImage()
  const locked = useReferenceImageLocked()
  const { clearImage, setLocked } = useReferenceImageActions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const opacityPercent = Math.round((overlay?.opacity ?? DEFAULT_OVERLAY_OPACITY) * 100)

  const updateOpacity = (opacity: number) => {
    if (!overlay?.corners) return
    void navigate({
      search: (prev) => ({
        ...serializeIndexSearch(prev),
        overlay: encodeOverlaySearch({ corners: overlay.corners, opacity }),
      }),
      replace: true,
    })
  }

  const handleClear = () => {
    clearImage()
    void navigate({
      search: (prev) => {
        const next = serializeIndexSearch(prev)
        delete next.overlay
        return next
      },
      replace: true,
    })
  }

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files[0]
    if (file) await onImageFile(file)
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-950/70 p-4',
        'shadow-sm shadow-black/20',
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <h2 className="text-sm font-medium text-white">Reference image</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Drop a plan image here, paste anywhere on the page, or choose a file. The image stays in
        memory only; corners and opacity are shareable via the URL.
      </p>

      <div
        className={cn(
          'mt-4 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
          dragActive ? 'border-sky-400 bg-sky-950/40' : 'border-slate-700 bg-slate-900/60',
        )}
      >
        <p className="text-sm text-slate-300">Drop image here</p>
        <p className="mt-1 text-xs text-slate-500">or paste with Ctrl/Cmd+V</p>
        <button
          type="button"
          className="mt-4 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (file) await onImageFile(file)
            event.target.value = ''
          }}
        />
      </div>

      {overlay?.corners && !hasImage ? (
        <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          Shared overlay alignment is in the URL. Paste or drop the plan image again to restore the
          overlay.
        </p>
      ) : null}

      {hasImage || overlay?.corners ? (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Opacity
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={100}
                value={opacityPercent}
                disabled={!overlay?.corners}
                onChange={(event) => updateOpacity(Number(event.target.value) / 100)}
                className="w-full accent-sky-400"
              />
              <span className="w-10 text-right text-sm text-slate-300">{opacityPercent}%</span>
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium',
                locked
                  ? 'bg-sky-600 text-white hover:bg-sky-500'
                  : 'bg-slate-800 text-slate-100 hover:bg-slate-700',
              )}
              onClick={() => setLocked(!locked)}
              disabled={!hasImage}
            >
              {locked ? 'Edit corners' : 'Lock overlay'}
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
