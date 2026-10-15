import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// maplibre-gl 6 loads its worker from a file next to its own module. Once Vite has bundled
// maplibre-gl that file is not there, so point it at the copy Vite emits.
setWorkerUrl(workerUrl)
