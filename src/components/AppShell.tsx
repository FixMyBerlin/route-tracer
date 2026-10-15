import type { MapParam } from '@osm-editor-kit/osm-map-url'
import { useState } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import { RouteTracerMap } from '@/components/RouteTracerMap'
import { Sidebar } from '@/components/Sidebar'
import { WorkflowNav } from '@/components/WorkflowNav'
import { useReferenceImageInput } from '@/shared/reference-image/use-reference-image-input'
import { useRestoreReferenceImage } from '@/shared/reference-image/use-restore-reference-image'
import { useHydrateRouteFromUrl } from '@/shared/routing/use-route-url-sync'
import { useWorkflow } from '@/shared/routing/use-workflow'
import { useRestoreTrack } from '@/shared/track-source/use-restore-track'
import { isTrackFile, useTrackInput } from '@/shared/track-source/use-track-input'

type AppShellProps = {
  mapViewport: MapParam
}

export function AppShell({ mapViewport }: AppShellProps) {
  return (
    <MapProvider>
      <Workspace mapViewport={mapViewport} />
    </MapProvider>
  )
}

/** Inside the MapProvider, so file input can move the map to what was loaded. */
function Workspace({ mapViewport }: AppShellProps) {
  const { mode, step } = useWorkflow()
  const [zoom, setZoom] = useState(mapViewport.zoom)
  useRestoreReferenceImage()
  useRestoreTrack()
  useHydrateRouteFromUrl()
  const { handleImageFile, handleMapDrop, preventDragOver } = useReferenceImageInput({
    enabled: step === 'image',
  })
  const { handleTrackFile } = useTrackInput()

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    const file = event.dataTransfer.files[0]
    if (step === 'track' && file && isTrackFile(file)) {
      event.preventDefault()
      await handleTrackFile(file)
      return
    }
    await handleMapDrop(event)
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <WorkflowNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          className="relative min-h-0 min-w-0 flex-1"
          onDragOver={preventDragOver}
          onDrop={(event) => void handleDrop(event)}
        >
          <RouteTracerMap
            mapViewport={mapViewport}
            onZoomChange={setZoom}
            step={step}
            mode={mode}
            zoom={zoom}
          />
        </main>
        <Sidebar onImageFile={handleImageFile} onTrackFile={handleTrackFile} zoom={zoom} />
      </div>
    </div>
  )
}
