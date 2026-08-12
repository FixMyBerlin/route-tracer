export const workflowSteps = ['image', 'tracing', 'export'] as const

export type WorkflowStep = (typeof workflowSteps)[number]

export const workflowStepLabels: Record<WorkflowStep, string> = {
  image: 'Image',
  tracing: 'Tracing',
  export: 'Export',
}
