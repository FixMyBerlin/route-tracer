/** GitHub Pages project-site path (must match the repository name). */
export const GITHUB_PAGES_BASE = '/route-tracer/'

/** TanStack Router `basepath` from Vite `import.meta.env.BASE_URL`. */
export function viteBaseToRouterBasepath(baseUrl: string) {
  if (baseUrl === '/') return '/'
  return baseUrl.replace(/\/$/, '')
}
