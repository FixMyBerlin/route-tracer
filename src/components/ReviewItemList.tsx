import { useMap } from 'react-map-gl/maplibre'
import { fitMapToLine } from '@/shared/map/fit-map-to-line'
import type { ReviewItem } from '@/shared/routing/review-item'

type ReviewItemListProps = {
  items: ReviewItem[]
  onAccept?: (item: ReviewItem) => void
}

export function ReviewItemList({ items, onAccept }: ReviewItemListProps) {
  const { mainMap } = useMap()

  return (
    <ol className="mt-3 space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="flex items-start gap-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm"
        >
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/90 text-xs font-semibold text-slate-950">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="leading-tight text-slate-300">{item.title}</p>
            <div className="mt-1 flex gap-3 text-xs">
              <button
                type="button"
                className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
                onClick={() => fitMapToLine(mainMap?.getMap(), item.coordinates)}
              >
                Show
              </button>
              {onAccept ? (
                <button
                  type="button"
                  className="text-slate-400 underline underline-offset-2 hover:text-slate-200"
                  onClick={() => onAccept(item)}
                >
                  Looks right
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
