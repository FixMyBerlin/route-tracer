# Route Tracer

Turn a picture of a route or a GPS track into clean map geometry along OpenStreetMap roads, adjust it, and export it as GeoJSON. The exported route is the deliverable — you can share it, open it elsewhere, or come back later and trace again from the same plan.

**Try it:** [fixmyberlin.github.io/route-tracer](https://fixmyberlin.github.io/route-tracer/)

> [!NOTE]
> Interactive route snapping is powered by [route-snapper](https://github.com/dabreegster/route_snapper) by Dustin Carlino — thank you, Dustin!

## What it does

You have an existing route and want proper map geometry for it. Route Tracer has two ways in, and both end with the same route you can adjust and export:

- **Trace an image** — a plan, sketch, or map graphic: line it up with the basemap, then draw the route over it.
- **Snap a track** — a GPX or GeoJSON track: it is snapped onto the roads automatically, then you fix what the snapping got wrong.

The whole app runs in your browser — nothing is uploaded to a server. Almost everything you do is encoded in the URL, so you can bookmark the page, share a link, or pick up later where you left off: map position, overlay alignment, the route, and an optional link to where the plan lives. Image and track files are not in the URL; on another device or after the local copy expires, add them again — everything else from the link still applies.

## Trace an image

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

The file also holds the route's points (a `MultiPoint` with `role: "route-tracer:waypoints"`) and, in track mode, the source track (`role: "route-tracer:source-track"`). Drop the file into **Snap a track** to open the route again exactly as it was.

## Snap a track

1. **Track** — choose or drop a GPX or GeoJSON file. Several tracks or parts in one file are joined in file order; the jumps between them become freehand stretches. Load the roads along the track, then **Snap to roads**: a point is placed about every 150 m on the nearest road, and where no road is within reach the route follows your track freehand.
2. **Adjust** — your track is the dashed pink line. Places where the route and the track disagree, and stretches drawn freehand, are highlighted and listed under _Check against your track_; press **N** to jump to the next one. Fix them with the same tools as in tracing. A place leaves the list once the route matches the track, or when you mark it _Looks right_.
3. **Export** — as above.

Every point you place or move is yours: **Snap again, keep my points** re-runs the snapping on the track but keeps them.

## How a route is stored

The URL stores the route's _decisions_, not its geometry: a short list of waypoints, each marked as snapped or freehand, and as placed by you or by the snapping. That keeps links short (a few hundred characters instead of several kilobytes) and lets the route be rebuilt on current OpenStreetMap data.

When you open a link, the roads under the route are loaded and the waypoints are routed again. The URL also stores the length of each stretch, so if OpenStreetMap changed and a stretch now comes out different, the app shows which ones and only saves over the link once you agree.

The image and the track stay in your browser (IndexedDB, about three months). The exported GeoJSON carries the waypoints and the track, so it is the portable copy.

## For developers

Requires [Bun](https://bun.sh) (≥ 1.3.14).

```bash
bun install
bun run dev
```

Open `http://127.0.0.1:5210/`. The port is fixed; the dev server refuses to start if it is taken. The map viewport syncs to the `?map=zoom/lat/lng` search param.

Useful scripts:

- `bun run check` — type-check, lint, format, tests
- `bun run build` — production build to `dist/`
- `bun run preview:pages` — preview the GitHub Pages bundle at `/route-tracer/`
- `bun run e2e` — Playwright smoke tests (Overpass is mocked)

E2E setup (once per machine): `bunx playwright install chromium`

## License

Copyright (C) FixMyBerlin GmbH.

This project is [licensed under the AGPL-3.0](./LICENSE.md).
