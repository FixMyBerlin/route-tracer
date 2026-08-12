import type { MapParam } from '@osm-editor-kit/osm-map-url'
import { useState } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import { RouteTracerMap } from '@/components/RouteTracerMap'
import { Sidebar } from '@/components/Sidebar'
import { WorkflowNav } from '@/components/WorkflowNav'
import { Route } from '@/routes/index'
import { useReferenceImageInput } from '@/shared/reference-image/use-reference-image-input'
import { useRestoreReferenceImage } from '@/shared/reference-image/use-restore-reference-image'

type AppShellProps = {
  mapViewport: MapParam
}

export function AppShell({ mapViewport }: AppShellProps) {
  const step = Route.useSearch({ select: (search) => search.step })
  const [zoom, setZoom] = useState(mapViewport.zoom)
  useRestoreReferenceImage()
  const { handleImageFile, handleMapDrop, preventDragOver } = useReferenceImageInput({
    enabled: step === 'image',
  })

  return (
    <MapProvider>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <WorkflowNav />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main
            className="relative min-h-0 min-w-0 flex-1"
            onDragOver={step === 'image' ? preventDragOver : undefined}
            onDrop={step === 'image' ? handleMapDrop : undefined}
          >
            <RouteTracerMap
              mapViewport={mapViewport}
              onZoomChange={setZoom}
              step={step}
              zoom={zoom}
            />
          </main>
          <Sidebar onImageFile={handleImageFile} zoom={zoom} />
        </div>
      </div>
    </MapProvider>
  )
}
