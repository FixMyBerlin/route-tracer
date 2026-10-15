import { Route } from '@/routes/index'
import { firstStepOf, modeSteps } from '@/shared/routing/workflow-steps'

/** Mode and step from the URL; a step that belongs to the other mode opens this mode's first. */
export function useWorkflow() {
  const mode = Route.useSearch({ select: (search) => search.mode })
  const urlStep = Route.useSearch({ select: (search) => search.step })
  const step = modeSteps[mode].includes(urlStep) ? urlStep : firstStepOf(mode)
  return { mode, step, steps: modeSteps[mode] }
}
