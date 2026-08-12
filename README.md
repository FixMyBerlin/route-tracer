# Route Tracer

Browser app to **trace an existing route** from a temporary reference image into proper map geometry: mostly OSM-snapped segments, with explicit manual stretches where OSM cannot follow reality (for example a new bridge).

Export is a GeoJSON `FeatureCollection` of segment LineStrings. The reference image stays in the browser only and is never uploaded.

Domain language and terminology: [`CONTEXT.md`](./CONTEXT.md).

## Development

Requires [Bun](https://bun.sh) (≥ 1.3.14).

Depends on `@osm-editor-kit/*` **alpha** packages from npm (`0.1.0-alpha.0`). Install with Bun; no local street-space-editor clone is required. A `package.json` override pins `@osm-editor-kit/osm-data` so nested `workspace:*` ranges in the first alpha tarballs resolve on npm.

```bash
bun install
bun run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173/`). The map viewport syncs to the `?map=zoom/lat/lng` search param.

Other scripts:

- `bun run check` — type-check, lint, format, tests, knip (mutating)
- `bun run build` — production build to `dist/`
- `bun run preview:pages` — build and preview the GitHub Pages bundle at `/route-tracer/`
- `bun run e2e` — Playwright smoke (starts dev server if needed)

E2E setup (once per machine):

```bash
bunx playwright install chromium
```

## How to use

1. **Paste or drop a reference image** in the sidebar (or on the map). The image bytes stay in memory only.
2. **Stretch the overlay** — drag corner handles until the plan lines up with the basemap. Use the opacity slider if needed.
3. **Lock the overlay** when alignment is good so corner handles do not move while tracing.
4. **Zoom to level 15 or higher** — OSM highway data and the routing graph load at zoom ≥ 15. Wait until the Routing panel shows the graph is ready.
5. **Click waypoints on the map** to build snapped segments between connection points. Drag waypoints to adjust snapped stretches.
6. **Draw-through (manual segments)** — toggle draw-through mode for stretches OSM cannot follow (e.g. a new bridge). Sketch the polyline; adjacent snapped segments reconnect at the endpoints.
7. **Export** — download GeoJSON from the Route segments panel, or copy the page URL to share alignment and route geometry.

### Shareable vs ephemeral state

| Shareable (URL)              | Ephemeral (lost on refresh)                  |
| ---------------------------- | -------------------------------------------- |
| Map viewport (`?map=`)       | Reference image bytes                        |
| Overlay corners and opacity  | OSM routing graph / coverage cache           |
| Route segments and waypoints | Transient UI mode (e.g. draw-through active) |

Opening a shared link restores overlay alignment and route geometry. Re-paste or re-drop the reference image to see the plan again.

### Export notes

- Each route segment is exported as its own GeoJSON `LineString` with `segment_kind` (`snapped` | `manual`).
- **OSM way IDs** on snapped segments (`osm_way_ids`) are deferred — export is geometry-first until a consumer needs way-level references.

## Status

Greenfield bootstrap. Research notes: [`research/`](./research/). Near-future exploration: [vector tiles as routing source](./research/vector-tiles-as-routing-source.md) (vs Overpass).

## GitHub Pages

Published at **https://fixmyberlin.github.io/route-tracer/** when [GitHub Pages](https://github.com/FixMyBerlin/route-tracer/settings/pages) is set to **GitHub Actions** as the source.

The production build uses `base: /route-tracer/` (see `src/shared/site-base.ts`). After each build, `index.html` is copied to `404.html` so direct links and refreshes work as a SPA. `public/.nojekyll` disables Jekyll processing.

Test the Pages bundle locally:

```bash
bun run preview:pages
# open http://127.0.0.1:4173/route-tracer/
```

For Overpass API origin allowlisting, use `https://fixmyberlin.github.io` (no path).

## License

Copyright (C) FixMyBerlin GmbH.

This project is [licensed under the AGPL-3.0](./LICENSE.md).
