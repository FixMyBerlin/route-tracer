import { useMap } from 'react-map-gl/maplibre'
import { useMapLoaded } from '@/shared/map/map-chrome-store'
import { viewMinZoom } from '@/shared/routing/constants'

type ViewMinZoomOverlayProps = {
  zoom: number
}

/** Matches MapLibre `.maplibregl-ctrl-top-left .maplibregl-ctrl` margin. */
const GEOCODER_INSET_PX = 10
/** MapTiler geocoding `form` width (`width: 270px`). */
const GEOCODER_WIDTH_PX = 270
/** Approximate geocoder height (input 29px + host border). */
const GEOCODER_HEIGHT_PX = 33

function formatZoom(zoom: number) {
  return zoom.toFixed(1).replace(/\.0$/, '')
}

export function ViewMinZoomOverlay({ zoom }: ViewMinZoomOverlayProps) {
  const { mainMap } = useMap()
  const mapLoaded = useMapLoaded()

  if (zoom >= viewMinZoom) return null

  const handleZoomIn = () => {
    if (!mainMap || !mapLoaded) return
    mainMap.easeTo({ zoom: viewMinZoom, duration: 500 })
  }

  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: GEOCODER_INSET_PX,
        top: GEOCODER_INSET_PX + GEOCODER_HEIGHT_PX + GEOCODER_INSET_PX,
        width: GEOCODER_WIDTH_PX,
      }}
    >
      <div className="pointer-events-auto rounded-xl bg-slate-950/95 px-3 py-2.5 text-left shadow-lg ring-1 ring-slate-700 backdrop-blur-sm">
        <p className="text-sm font-medium text-white">Zoom in to load OSM</p>
        <p className="mt-1 text-xs leading-tight text-slate-400">
          Street data for routing loads at zoom {viewMinZoom} and above (current zoom{' '}
          {formatZoom(zoom)}).
        </p>
        <button
          type="button"
          className="mt-2.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!mainMap || !mapLoaded}
          onClick={handleZoomIn}
        >
          Zoom in
        </button>
      </div>
    </div>
  )
}
