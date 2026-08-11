import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import browserslistToEsbuild from 'browserslist-to-esbuild'
import { defineConfig } from 'vite'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const streetSpaceRoot = path.resolve(projectRoot, '../../OSM/street-space-editor')
const bunLinksCache = path.join(os.homedir(), '.bun/install/cache/links')

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
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
      allow: [projectRoot, streetSpaceRoot, bunLinksCache],
    },
  },
  build: {
    target: browserslistToEsbuild(),
    outDir: 'dist',
    sourcemap: true,
  },
})
