import type { SourceMode } from '@/shared/routing/search-schema'

export const workflowSteps = ['image', 'track', 'tracing', 'export'] as const

export type WorkflowStep = (typeof workflowSteps)[number]

/** Both modes end the same way: adjust the route on the map, then export it. */
export const modeSteps: Record<SourceMode, readonly WorkflowStep[]> = {
  image: ['image', 'tracing', 'export'],
  track: ['track', 'tracing', 'export'],
}

export function workflowStepLabel(step: WorkflowStep, mode: SourceMode) {
  if (step === 'tracing') return mode === 'track' ? 'Adjust' : 'Tracing'
  return { image: 'Image', track: 'Track', export: 'Export' }[step]
}

export function firstStepOf(mode: SourceMode): WorkflowStep {
  return mode === 'track' ? 'track' : 'image'
}
