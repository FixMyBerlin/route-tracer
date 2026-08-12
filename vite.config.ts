import { copyFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import browserslistToEsbuild from 'browserslist-to-esbuild'
import { defineConfig, type Plugin } from 'vite'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const bunLinksCache = path.join(os.homedir(), '.bun/install/cache/links')

/** Keep in sync with `src/shared/site-base.ts`. */
const GITHUB_PAGES_BASE = '/route-tracer/'

function githubPagesSpaFallback(): Plugin {
  return {
    name: 'github-pages-spa-fallback',
    closeBundle() {
      const distDir = path.resolve(projectRoot, 'dist')
      copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'))
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? GITHUB_PAGES_BASE : '/',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    ...(mode === 'production' ? [githubPagesSpaFallback()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    fs: {
      allow: [projectRoot, bunLinksCache],
    },
  },
  build: {
    target: browserslistToEsbuild(),
    outDir: 'dist',
    sourcemap: true,
  },
  assetsInclude: ['**/*.wasm'],
}))
