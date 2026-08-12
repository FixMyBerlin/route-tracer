import { AppLogo } from '@/components/AppLogo'
import { Route } from '@/routes/index'
import { cn } from '@/shared/cn'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import {
  workflowStepLabels,
  workflowSteps,
  type WorkflowStep,
} from '@/shared/routing/workflow-steps'

function BreadcrumbChevron() {
  return (
    <svg
      fill="currentColor"
      viewBox="0 0 24 44"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-full w-6 shrink-0 text-slate-700"
    >
      <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
    </svg>
  )
}

export function WorkflowNav() {
  const step = Route.useSearch({ select: (search) => search.step })
  const { updateSearch } = useIndexSearchNavigation()

  const goToStep = (next: WorkflowStep) => {
    updateSearch({ step: next }, { replace: false })
  }

  return (
    <nav
      aria-label="Workflow"
      className="relative z-20 flex shrink-0 border-b border-slate-800 bg-slate-900/95 shadow-lg shadow-black/40"
    >
      <ol role="list" className="flex w-full space-x-4 px-4 sm:px-6">
        <li className="flex">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => goToStep('image')}
              className="text-slate-400 hover:text-slate-300"
            >
              <AppLogo className="size-5" />
              <span className="sr-only">Route Tracer</span>
            </button>
          </div>
        </li>
        {workflowSteps.map((pageStep) => {
          const current = pageStep === step
          return (
            <li key={pageStep} className="flex">
              <div className="flex items-center">
                <BreadcrumbChevron />
                <button
                  type="button"
                  onClick={() => goToStep(pageStep)}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'ml-4 border-b-2 py-3 text-sm font-medium transition-colors',
                    current
                      ? 'border-sky-400 text-base font-semibold text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-200',
                  )}
                >
                  {workflowStepLabels[pageStep]}
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
