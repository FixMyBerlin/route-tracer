import { useMapChromeOsmBusy } from '@/shared/map/map-chrome-store'

export function MapLoadingIndicator() {
  const busy = useMapChromeOsmBusy()

  if (!busy) return null

  return (
    <div
      className="pointer-events-none absolute top-14 left-4 z-20 flex items-center gap-2 rounded-full bg-slate-950/90 px-3 py-2 text-sm text-slate-200 shadow-lg ring-1 ring-slate-700"
      aria-live="polite"
      aria-label="Loading OSM"
    >
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400"
      />
      Loading OSM…
    </div>
  )
}
