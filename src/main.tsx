import { redirectLegacyMapHash } from '@osm-editor-kit/osm-map-url'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { routerSearch } from '@/shared/routing/router-search'
import { viteBaseToRouterBasepath } from '@/shared/site-base'
import { routeTree } from './routeTree.gen'
import './components/layouts/global.css'

redirectLegacyMapHash()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
})

const router = createRouter({
  routeTree,
  basepath: viteBaseToRouterBasepath(import.meta.env.BASE_URL),
  trailingSlash: 'never',
  parseSearch: routerSearch.parse,
  stringifySearch: routerSearch.stringify,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
