# Route Tracer

A browser tool for redrawing an existing route (from a reference image) as proper map geometry: mostly OSM-snapped segments with explicit manual stretches where the basemap cannot follow the real path.

## Language

**Reference image**:
A temporary user-uploaded picture (paste or drop) showing an existing route or plan. Used only for visual alignment; never exported as geometry.
_Avoid_: Source image, scan, attachment

**Map canvas**:
The single main panel: a MapLibre basemap with the reference image stretched on top as a semi-transparent overlay.
_Avoid_: Map panel, main view, split view

**Sidebar**:
Secondary UI for image upload, overlay controls, route status, and export — not a second geometry view.
_Avoid_: Right panel, image panel

**Shareable state**:
Client state encoded in the URL so a link restores a session's work: route segments, waypoints, optionally image overlay position (corners, opacity), optional `imageSource` (where to find the plan again), and optional `imageId` (same-browser IndexedDB pointer to the reference image bytes). Long payloads are compressed or encoded to keep URLs practical.
_Avoid_: URL params, query string, deep link

**Local image restore**:
Reference image bytes stay in the browser (IndexedDB), keyed by URL `imageId`. Restores after refresh on the same origin for up to ~3 months; not available on another device or after prune/clear. Cross-device sharing still requires re-pasting (or using `imageSource`).
_Avoid_: localStorage image, uploaded image, server image

**Local OSM coverage cache**:
Merged Overpass graph + coverage polygon for the current session key, stored in IndexedDB on the same origin. Restored into TanStack Query on boot so pans do not re-hit Overpass for already covered areas. Age is shown rounded to the hour; the user can reload the current view or prefer fresh network fetches (skips restore/save). Pruned after ~14 days. Not in the URL and not shared across devices.
_Avoid_: Overpass tile cache, localStorage OSM, bbox store

**Ephemeral state**:
Client state that is not in the URL and is lost on refresh: the rebuilt route-snapper WASM graph (derived from restored OSM coverage), and transient UI mode (e.g. draw-through active).
_Avoid_: Local state, temp state, session storage

**OSM coverage**:
The geographic area for which OSM data has been fetched and merged into a session routing graph. Grows incrementally as the user pans and zooms — only missing viewport strips are fetched. Managed by `@osm-editor-kit/osm-coverage` (npm alpha); durable across reloads via IndexedDB.
_Avoid_: Loaded area, bbox, extract, tile

**Route**:
The full path the user is building on the map canvas, composed of alternating snapped and manual pieces.
_Avoid_: Path, line, polyline (when meaning the whole route)

**Snapped segment**:
A segment whose geometry follows the OSM routing graph between two connection points. May carry OSM way references when the routing library exposes them.
_Avoid_: Routed part, auto segment, graph segment

**Manual segment**:
A portion of the route entered via draw-through mode: the user sketches a polyline while the snapper reconnects at the end point. Not derived from the OSM graph.
_Avoid_: Freehand (UI label only), gap, off-network

**Segment**:
One contiguous piece of the route, exported as its own GeoJSON `LineString` feature with typed properties. A route is an ordered list of segments.
_Avoid_: Leg, part, section

**OSM way references**:
Optional metadata on a snapped segment: an ordered list of OSM way IDs the segment travels along. Included when `route-snapper` provides them without extra work; precision (full way vs partial) deferred until a consumer needs it.
_Avoid_: road_ids (implementation term), edge_ids

**Draw-through mode**:
Interaction mode where the user sketches a manual segment on the map; adjacent snapped segments recalculate at the connection points.
_Avoid_: Freehand mode, pencil tool

**Waypoint**:
A connection point where two segments meet. Moving or adding waypoints recalculates adjacent snapped segments.
_Avoid_: Node, point, marker (UI terms only)

**Export**:
A GeoJSON `FeatureCollection` of segment features in route order. Each feature is a `LineString` with a `segment_kind` property (`snapped` | `manual`). Snapped features may include `osm_way_ids` when available; manual features mark draw-through origin. The same structure is mirrored in shareable state (URL).
_Avoid_: Download, output file

## Flagged ambiguities

**OSM attribution precision**: Whether snapped segments need partial-way detail (`from_node` / `to_node`) is undecided. v1 captures ordered way IDs only if `route-snapper` returns them cheaply (LTN's `road_ids` pattern); otherwise geometry-only export is acceptable.

## Example dialogue

**Expert:** I paste a construction plan into the sidebar. The image appears on the map — I drag the corners until the plan lines up with the streets.

**Dev:** Good. Now you click start and end on the map. The route snaps along OSM between them.

**Expert:** Right, but here at the new bridge OSM still shows the old crossing. I switch to draw-through and sketch across the new bridge.

**Dev:** That becomes a manual segment in the export — its own LineString with `segment_kind: manual`. The stretches before and after stay snapped, each with the OSM way IDs they follow.

**Expert:** Exactly. Three features in order. I can share the link — route and overlay alignment come back; on this browser the plan image restores from IndexedDB when `imageId` is still valid, otherwise I re-paste it (the optional source URL helps). OSM highway coverage for areas I already loaded also comes back from IndexedDB so I am not re-querying Overpass for the same viewport. The GeoJSON export is what we keep for downstream use.
