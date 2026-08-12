import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { indexSearchDefaults, indexSearchSchema } from '@/shared/routing/search-schema'

export const Route = createFileRoute('/')({
  validateSearch: indexSearchSchema,
  search: {
    middlewares: [
      stripSearchParams({
        network: indexSearchDefaults.network,
        coverageDebug: indexSearchDefaults.coverageDebug,
      }),
    ],
  },
  component: IndexPage,
})

function IndexPage() {
  const mapViewport = Route.useSearch({ select: (search) => search.map })

  return <AppShell mapViewport={mapViewport} />
}
