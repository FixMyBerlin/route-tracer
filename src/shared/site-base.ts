/** TanStack Router `basepath` from Vite `import.meta.env.BASE_URL`. */
export function viteBaseToRouterBasepath(baseUrl: string) {
  if (baseUrl === '/') return '/'
  return baseUrl.replace(/\/$/, '')
}
