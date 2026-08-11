import { ReferenceImagePanel } from '@/components/ReferenceImagePanel'
import { RoutePanel } from '@/components/RoutePanel'
import { RoutingStatusPanel } from '@/components/RoutingStatusPanel'
type SidebarProps = {
  onImageFile: (file: File) => Promise<boolean>
  zoom: number
}

export function Sidebar({ onImageFile, zoom }: SidebarProps) {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/95">
      <header className="border-b border-slate-800 px-4 py-5">
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
          Route Tracer
        </p>
        <h1 className="mt-2 text-lg font-semibold text-white">Trace a route</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Align a reference image, then trace snapped and manual route segments.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <ReferenceImagePanel onImageFile={onImageFile} />
        <RoutingStatusPanel zoom={zoom} />
        <RoutePanel />
      </div>
    </aside>
  )
}
