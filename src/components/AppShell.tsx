import type { MapParam } from '@osm-editor-kit/osm-map-url'
import { MapProvider } from 'react-map-gl/maplibre'
import { RouteTracerMap } from '@/components/RouteTracerMap'
import { Sidebar } from '@/components/Sidebar'

type AppShellProps = {
  mapViewport: MapParam
}

export function AppShell({ mapViewport }: AppShellProps) {
  return (
    <MapProvider>
      <div className="flex h-full w-full overflow-hidden">
        <main className="relative min-h-0 min-w-0 flex-1">
          <RouteTracerMap mapViewport={mapViewport} />
        </main>
        <Sidebar />
      </div>
    </MapProvider>
  )
}
