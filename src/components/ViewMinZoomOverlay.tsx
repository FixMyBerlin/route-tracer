import { useMap } from 'react-map-gl/maplibre'
import { MAIN_MAP_ID } from '@/shared/map/map-ids'
import { viewMinZoom } from '@/shared/routing/constants'

type ViewMinZoomOverlayProps = {
  zoom: number
}

export function ViewMinZoomOverlay({ zoom }: ViewMinZoomOverlayProps) {
  const maps = useMap()
  const map = maps[MAIN_MAP_ID]

  if (zoom >= viewMinZoom) return null

  const handleZoomIn = () => {
    map?.easeTo({ zoom: viewMinZoom, duration: 500 })
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
      <div className="pointer-events-auto max-w-sm rounded-xl bg-slate-950/95 px-5 py-4 text-center shadow-lg ring-1 ring-slate-700 backdrop-blur-sm">
        <p className="text-base font-medium text-white">Zoom in to load OSM</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Street data for routing loads at zoom {viewMinZoom} and above.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          onClick={handleZoomIn}
        >
          Zoom in
        </button>
      </div>
    </div>
  )
}
