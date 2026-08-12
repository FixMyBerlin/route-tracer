import { ExportPanel } from '@/components/ExportPanel'
import { ReferenceImagePanel } from '@/components/ReferenceImagePanel'
import { RoutePanel } from '@/components/RoutePanel'
import { RoutingStatusPanel } from '@/components/RoutingStatusPanel'
import { Route } from '@/routes/index'
import { workflowStepLabels, type WorkflowStep } from '@/shared/routing/workflow-steps'

type SidebarProps = {
  onImageFile: (file: File) => Promise<boolean>
  zoom: number
}

const stepCopy: Record<WorkflowStep, { title: string; description: string }> = {
  image: {
    title: 'Align the reference image',
    description: 'Paste or drop a plan, then stretch the corners until it matches the basemap.',
  },
  tracing: {
    title: 'Trace the route',
    description: 'Draw snapped OSM stretches and manual segments where the basemap cannot follow.',
  },
  export: {
    title: 'Export the route',
    description: 'Download GeoJSON or copy a shareable link. Route geometry stays in the URL.',
  },
}

export function Sidebar({ onImageFile, zoom }: SidebarProps) {
  const step = Route.useSearch({ select: (search) => search.step })
  const copy = stepCopy[step]

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/95">
      <header className="border-b border-slate-800 px-4 py-5">
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
          {workflowStepLabels[step]}
        </p>
        <h1 className="mt-2 text-lg font-semibold text-white">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{copy.description}</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
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
