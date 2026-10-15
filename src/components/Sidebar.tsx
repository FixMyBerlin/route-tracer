import { ExportPanel } from '@/components/ExportPanel'
import { ModeSwitch } from '@/components/ModeSwitch'
import { ReferenceImagePanel } from '@/components/ReferenceImagePanel'
import { RouteChangesNotice } from '@/components/RouteChangesNotice'
import { RoutePanel } from '@/components/RoutePanel'
import { RoutingStatusPanel } from '@/components/RoutingStatusPanel'
import { TrackPanel } from '@/components/TrackPanel'
import { TrackReviewPanel } from '@/components/TrackReviewPanel'
import type { SourceMode } from '@/shared/routing/search-schema'
import { useWorkflow } from '@/shared/routing/use-workflow'
import type { WorkflowStep } from '@/shared/routing/workflow-steps'
import type { LoadedTrack } from '@/shared/track-source/loaded-track'

type SidebarProps = {
  onImageFile: (file: File) => Promise<boolean>
  onTrackFile: (file: File) => Promise<LoadedTrack | null>
  zoom: number
}

const kbdClass =
  'rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-slate-400'

function SwitchModeHint() {
  return (
    <>
      Use{' '}
      <kbd
        className={kbdClass}
        title="Tap S to switch draw mode, hold S to switch only while pressed"
      >
        S
      </kbd>{' '}
      to switch between freehand and route snapping — tap to switch, or hold it to switch only while
      pressed.
    </>
  )
}

function stepCopy(
  step: WorkflowStep,
  mode: SourceMode,
): { title: string; description: React.ReactNode } {
  switch (step) {
    case 'image':
      return {
        title: 'Align the reference image',
        description: 'Paste or drop a plan, then stretch the corners until it matches the basemap.',
      }
    case 'track':
      return {
        title: 'Snap a GPS track',
        description:
          'Upload a GPX or GeoJSON track. It is snapped onto OpenStreetMap roads, then you fix whatever the snapping got wrong.',
      }
    case 'tracing':
      return mode === 'track'
        ? {
            title: 'Adjust the route',
            description: (
              <>
                Your track is the dashed line. Check the highlighted places and drag points to fix
                the route. <SwitchModeHint />
              </>
            ),
          }
        : {
            title: 'Trace the route',
            description: (
              <>
                Click on the map to draw the route. <SwitchModeHint />
              </>
            ),
          }
    case 'export':
      return {
        title: 'Export the route',
        description:
          'Download a GeoJSON FeatureCollection with one LineString per segment. The link keeps the route’s points, so it can be opened and routed again later.',
      }
  }
}

export function Sidebar({ onImageFile, onTrackFile, zoom }: SidebarProps) {
  const { mode, step, steps } = useWorkflow()
  const copy = stepCopy(step, mode)

  return (
    <aside className="relative z-10 flex h-full w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900/95 shadow-lg shadow-black/40">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        {step === steps[0] ? (
          <div className="mb-5">
            <ModeSwitch />
          </div>
        ) : null}
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-lg font-semibold text-white">{copy.title}</h1>
          <p className="mt-2 text-sm leading-tight text-slate-400">{copy.description}</p>
        </div>

        {step === 'image' ? <ReferenceImagePanel onImageFile={onImageFile} /> : null}
        {step === 'track' ? <TrackPanel onTrackFile={onTrackFile} /> : null}
        {step === 'tracing' ? (
          <>
            <RoutingStatusPanel zoom={zoom} />
            <RouteChangesNotice />
            {mode === 'track' ? <TrackReviewPanel /> : null}
            <RoutePanel />
          </>
        ) : null}
        {step === 'export' ? <ExportPanel /> : null}
      </div>
    </aside>
  )
}
