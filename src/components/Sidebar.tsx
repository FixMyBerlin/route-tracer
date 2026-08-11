import { cn } from '@/shared/cn'

const sidebarPanels = [
  {
    title: 'Reference image',
    description: 'Drop a temporary overlay image to trace against the basemap.',
  },
  {
    title: 'Route segments',
    description: 'OSM-snapped and manual stretches will appear here.',
  },
  {
    title: 'Export',
    description: 'GeoJSON FeatureCollection export stays in the browser.',
  },
] as const

export function Sidebar() {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/95">
      <header className="border-b border-slate-800 px-4 py-5">
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-400 uppercase">
          Route Tracer
        </p>
        <h1 className="mt-2 text-lg font-semibold text-white">Trace a route</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Placeholder shell for reference image, snapping, and export panels.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {sidebarPanels.map((panel) => (
          <section
            key={panel.title}
            className={cn(
              'rounded-xl border border-slate-800 bg-slate-950/70 p-4',
              'shadow-sm shadow-black/20',
            )}
          >
            <h2 className="text-sm font-medium text-white">{panel.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{panel.description}</p>
          </section>
        ))}
      </div>
    </aside>
  )
}
