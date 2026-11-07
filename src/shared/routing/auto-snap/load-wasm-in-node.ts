import { readFileSync } from 'node:fs'
import path from 'node:path'
import init from 'route-snapper'

/**
 * Loads both WASM modules from disk, for tests and benchmarks running under Node. In the browser
 * they are fetched; `buildRouteSnapperGraphBytes` would fetch them too, which Node cannot do.
 */
export async function loadWasmInNode() {
  const modules = path.resolve(import.meta.dirname, '../../../../node_modules')
  await init(readFileSync(path.join(modules, 'route-snapper/route_snapper_bg.wasm')))

  const osmDir = path.join(modules, '@osm-editor-kit/osm-route-snapper/vendor/osm-to-route-snapper')
  const osm = (await import(path.join(osmDir, 'osm_to_route_snapper.js'))) as {
    initSync: (options: { module: Uint8Array }) => unknown
  }
  osm.initSync({ module: readFileSync(path.join(osmDir, 'osm_to_route_snapper_bg.wasm')) })
}
