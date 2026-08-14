# Route Tracer

Trace a route from a reference image onto a real map, adjust it along OpenStreetMap roads, and export the geometry as GeoJSON. The exported route is the deliverable — you can share it, open it elsewhere, or come back later and trace again from the same plan.

**Try it:** [fixmyberlin.github.io/route-tracer](https://fixmyberlin.github.io/route-tracer/)

> [!NOTE]
> Interactive route snapping is powered by [route-snapper](https://github.com/dabreegster/route_snapper) by Dustin Carlino — thank you, Dustin!

## What it does

You have a picture of an existing route — a plan, sketch, or map graphic — and want proper map geometry for it. Route Tracer helps you:

1. Place that picture on top of a basemap and line it up with the streets.
2. Draw the route on the map, mostly following the OpenStreetMap road network.
3. Export the result as GeoJSON.

The whole app runs in your browser — nothing is uploaded to a server. Almost everything you do is encoded in the URL, so you can bookmark the page, share a link, or pick up later where you left off: map position, overlay alignment, route geometry, and an optional link to where the plan lives. The image file itself is not in the URL; on another device or after the local copy expires, paste or drop the plan again — the corners and opacity from the link still apply.

## Three steps

### 1. Align the reference image

Paste or drop your plan image (Ctrl/Cmd+V works anywhere on the page). Drag the corner handles until the graphic sits on the basemap. Use the opacity slider if you need to see through it.

**Tip:** Alignment works best when your reference looks similar to the basemap style — same kind of map, roughly the same scale and orientation. A street plan on a street map is easier than a schematic on a satellite view.

You can lock the overlay when it fits, so the corners do not move while you trace.

### 2. Trace the route

Zoom in until the OpenStreetMap road network has loaded (the routing panel in the sidebar shows when the graph is ready). Then click on the map to build the route.

Two draw modes:

- **Route snapping** — the line follows roads between your clicks.
- **Freehand drawing** — you sketch a stretch yourself, for example where OSM does not match reality yet.

Press **S** to switch modes while drawing.

Double-click to finish a line. You can drag waypoints to adjust the path, click an endpoint to keep drawing, or remove a point by clicking it. Snapped and freehand stretches are shown as solid and dashed lines.

### 3. Export the geometry

Download GeoJSON — one `LineString` per route segment, with `segment_kind` set to `snapped` or `manual`. Optionally simplify the geometry on export to drop extra points that were only needed for snapping.

## For developers

Requires [Bun](https://bun.sh) (≥ 1.3.14).

```bash
bun install
bun run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173/`). The map viewport syncs to the `?map=zoom/lat/lng` search param.

Useful scripts:

- `bun run check` — type-check, lint, format, tests
- `bun run build` — production build to `dist/`
- `bun run preview:pages` — preview the GitHub Pages bundle at `/route-tracer/`
- `bun run e2e` — Playwright smoke test

E2E setup (once per machine): `bunx playwright install chromium`

## License

Copyright (C) FixMyBerlin GmbH.

This project is [licensed under the AGPL-3.0](./LICENSE.md).
