import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/index'
import type { IndexSearch } from '@/shared/routing/search-schema'

type NavigateOptions = {
  replace?: boolean
}

/**
 * Typed index-route search reads and writes.
 * Pass parsed {@link IndexSearch} values — `routerSearch.stringify` encodes wire params.
 */
export function useIndexSearchNavigation() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const updateSearch = (
    partial: Partial<IndexSearch> | ((prev: IndexSearch) => Partial<IndexSearch>),
    options?: NavigateOptions,
  ) => {
    void navigate({
      search: (prev) => {
        const validatedPrev = prev as unknown as IndexSearch
        const updates = typeof partial === 'function' ? partial(validatedPrev) : partial
        const next: Record<string, unknown> = { ...validatedPrev }

        for (const [key, value] of Object.entries(updates)) {
          if (value === undefined) {
            delete next[key]
          } else {
            next[key] = value
          }
        }

        // Router types search as wire strings; `routerSearch.stringify` accepts parsed domain values.
        return next as never
      },
      replace: options?.replace ?? true,
    })
  }

  return { search, updateSearch, navigate }
}
