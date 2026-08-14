import { ExportPanel } from '@/components/ExportPanel'
import { ReferenceImagePanel } from '@/components/ReferenceImagePanel'
import { RoutePanel } from '@/components/RoutePanel'
import { RoutingStatusPanel } from '@/components/RoutingStatusPanel'
import { Route } from '@/routes/index'
import type { WorkflowStep } from '@/shared/routing/workflow-steps'

type SidebarProps = {
  onImageFile: (file: File) => Promise<boolean>
  zoom: number
}

const stepCopy: Record<WorkflowStep, { title: string; description: React.ReactNode }> = {
  image: {
    title: 'Align the reference image',
    description: 'Paste or drop a plan, then stretch the corners until it matches the basemap.',
  },
  tracing: {
    title: 'Trace the route',
    description: (
      <>
        Click on the map to draw the route. Use{' '}
        <kbd
          className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-slate-400"
          title="Press S to switch draw mode"
        >
          S
        </kbd>{' '}
        to toggle freehand and route snapping.
      </>
    ),
  },
  export: {
    title: 'Export the route',
    description:
      'Download a GeoJSON FeatureCollection with one LineString per segment. Route geometry, overlay alignment, and image source are encoded in the URL.',
  },
}

export function Sidebar({ onImageFile, zoom }: SidebarProps) {
  const step = Route.useSearch({ select: (search) => search.step })
  const copy = stepCopy[step]

  return (
    <aside className="relative z-10 flex h-full w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/95 shadow-lg shadow-black/40">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-lg font-semibold text-white">{copy.title}</h1>
          <p className="mt-2 text-sm leading-tight text-slate-400">{copy.description}</p>
        </div>

        {step === 'image' ? <ReferenceImagePanel onImageFile={onImageFile} /> : null}
        {step === 'tracing' ? (
          <>
            <RoutingStatusPanel zoom={zoom} />
            <RoutePanel />
          </>
        ) : null}
        {step === 'export' ? <ExportPanel /> : null}
      </div>
    </aside>
  )
}
