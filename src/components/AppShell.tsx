import type { MapParam } from '@osm-editor-kit/osm-map-url'
import { MapProvider } from 'react-map-gl/maplibre'
import { RouteTracerMap } from '@/components/RouteTracerMap'
import { Sidebar } from '@/components/Sidebar'
import { useReferenceImageInput } from '@/shared/reference-image/use-reference-image-input'

type AppShellProps = {
  mapViewport: MapParam
}

export function AppShell({ mapViewport }: AppShellProps) {
  const { handleImageFile, handleMapDrop, preventDragOver } = useReferenceImageInput()

  return (
    <MapProvider>
      <div className="flex h-full w-full overflow-hidden">
        <main
          className="relative min-h-0 min-w-0 flex-1"
          onDragOver={preventDragOver}
          onDrop={handleMapDrop}
        >
          <RouteTracerMap mapViewport={mapViewport} />
        </main>
        <Sidebar onImageFile={handleImageFile} />
      </div>
    </MapProvider>
  )
}
