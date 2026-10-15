import { twJoin } from 'tailwind-merge'
import type { SourceMode } from '@/shared/routing/search-schema'
import { useIndexSearchNavigation } from '@/shared/routing/use-index-search-navigation'
import { useWorkflow } from '@/shared/routing/use-workflow'
import { firstStepOf } from '@/shared/routing/workflow-steps'

const modes: { value: SourceMode; label: string }[] = [
  { value: 'image', label: 'Trace an image' },
  { value: 'track', label: 'Snap a track' },
]

/** The two ways to start a route. Switching keeps the route; only the source changes. */
export function ModeSwitch() {
  const { mode } = useWorkflow()
  const { updateSearch } = useIndexSearchNavigation()

  return (
    <div role="radiogroup" aria-label="Start from" className="flex rounded-lg bg-slate-800 p-0.5">
      {modes.map((option) => {
        const active = option.value === mode
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={twJoin(
              'flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-slate-950 text-white shadow' : 'text-slate-400 hover:text-slate-200',
            )}
            onClick={() =>
              updateSearch(
                { mode: option.value, step: firstStepOf(option.value) },
                { replace: false },
              )
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
