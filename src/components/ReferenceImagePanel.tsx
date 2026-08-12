import { useDebouncedCallback } from '@tanstack/react-pacer'
import { useRef, useState } from 'react'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import {
  useHasReferenceImage,
  useReferenceImageActions,
  useReferenceImageLocked,
} from '@/shared/reference-image/reference-image-store'
import { DEFAULT_OVERLAY_OPACITY } from '@/shared/reference-image/types'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'

type ReferenceImagePanelProps = {
  onImageFile: (file: File) => Promise<boolean>
}

type ImageSourceFieldProps = {
  imageSource: string
  onPersist: (value: string) => void
}

function ImageSourceField({ imageSource, onPersist }: ImageSourceFieldProps) {
  const [draft, setDraft] = useState(imageSource)

  return (
    <input
      type="url"
      inputMode="url"
      autoComplete="off"
      spellCheck={false}
      placeholder="https://…"
      value={draft}
      onChange={(event) => {
        const nextValue = event.target.value
        setDraft(nextValue)
        onPersist(nextValue)
      }}
      className="mt-3 w-full border-b border-slate-700 bg-transparent py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
    />
  )
}

export function ReferenceImagePanel({ onImageFile }: ReferenceImagePanelProps) {
  const { updateSearch } = useIndexSearchNavigation()
  const overlay = Route.useSearch({ select: (search) => search.overlay })
  const imageSource = Route.useSearch({ select: (search) => search.imageSource ?? '' })
  const hasImage = useHasReferenceImage()
  const locked = useReferenceImageLocked()
  const { clearImage, setLocked } = useReferenceImageActions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const persistImageSource = useDebouncedCallback(
    (value: string) => {
      const trimmed = value.trim()
      updateSearch({ imageSource: trimmed || undefined })
    },
    { wait: 400 },
  )

  const opacityPercent = Math.round((overlay?.opacity ?? DEFAULT_OVERLAY_OPACITY) * 100)

  const updateOpacity = (opacity: number) => {
    if (!overlay?.corners) return
    updateSearch({ overlay: { corners: overlay.corners, opacity } })
  }

  const handleClear = () => {
    clearImage()
    updateSearch({ overlay: undefined })
  }

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files[0]
    if (file) await onImageFile(file)
  }

  return (
    <section
      className="border-b border-slate-800 py-5"
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
        memory only; corners, opacity, and an optional source URL are shareable via the URL.
      </p>

      <div
        className={cn(
          'mt-4 border border-dashed px-4 py-6 text-center transition-colors',
          dragActive ? 'border-sky-400 bg-sky-950/30' : 'border-slate-700',
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

      <div className="mt-5 border-t border-slate-800 pt-5">
        <label className="block">
          <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Image source <span className="font-normal text-slate-500 normal-case">(optional)</span>
          </span>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Paste the URL to where to find the image so it&apos;s easier to share this app state and
            work on it later.
          </p>
          <ImageSourceField
            key={imageSource}
            imageSource={imageSource}
            onPersist={persistImageSource}
          />
        </label>
      </div>

      {overlay?.corners && !hasImage ? (
        <div className="mt-5 border-l-2 border-amber-500/60 pl-3 text-sm leading-6 text-amber-100">
          <p>
            Shared overlay alignment is in the URL. Paste or drop the plan image again to restore
            the overlay.
          </p>
          {imageSource ? (
            <p className="mt-2">
              Image to paste:{' '}
              <a
                href={imageSource}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sky-300 underline underline-offset-2 hover:text-sky-200"
              >
                {imageSource}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {hasImage || overlay?.corners ? (
        <div className="mt-5 space-y-4 border-t border-slate-800 pt-5">
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

          <button
            type="button"
            className="w-full rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            disabled={!overlay?.corners}
            onClick={() => {
              setLocked(true)
              updateSearch({ step: 'tracing' })
            }}
          >
            Continue to tracing
          </button>
        </div>
      ) : null}
    </section>
  )
}
