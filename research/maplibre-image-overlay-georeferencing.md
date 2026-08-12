# MapLibre image overlay & browser-only georeferencing

**Date:** 2026-08-10  
**Repo:** geometrie-nachzeichnen (geometry redrawing / tracing over an uploaded image)

## Problem statement

How can a web app take a **user-uploaded image** (kept in the browser—no server upload), place it on a **MapLibre GL JS** map, and **stretch / warp / fit** it to geographic coordinates so the user can draw or trace vector geometry over it?

Product constraints this note addresses:

- Image stays browser-only (memory / blob URL; not uploaded to a server).
- Control-point / GCP / georeferencing state may live in `localStorage`.
- Stretching / transform parameters live in local / client state.
- Focus on **techniques and user-facing patterns** from open-source web apps, plus MapLibre-native APIs.

---

## Recommended technique summary

**Best fit for MapLibre + browser-only upload + “stretch to fit” UI:**

1. **Upload → `URL.createObjectURL(file)` or `createImageBitmap(file)`** so the image never leaves the client ([MDN `createObjectURL`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)).
2. **Display with MapLibre `image` source + `raster` layer**, giving four corner `[lng, lat]` coordinates (top-left → clockwise). Corners **need not form a rectangle**—MapLibre documents that they can be a general quadrilateral ([Style Spec `image`](https://maplibre.org/maplibre-style-spec/sources/#image), [`ImageSource.setCoordinates`](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#setcoordinates)).
3. **Interactive stretch UI:** four draggable handles (Markers or a GeoJSON point layer) that call `setCoordinates` on drag. Primary code pattern: [map-image-overlay](https://github.com/CatCodeDanix/map-image-overlay) (see [Code references & plan](#code-references--implementation-plan) below). Minimal teaching demo: [mapbox-with-image-overlay-dragable-resizeable](https://github.com/Mr-Excel/mapbox-with-image-overlay-dragable-resizeable).
4. **Prefer feeding pixels via `updateImage({ image })`** (decoded `HTMLImageElement` / `ImageBitmap` / canvas) so you avoid relying on network fetch—official docs support this path ([`UpdateImageOptions`](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UpdateImageOptions/), [`ImageSource.updateImage`](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#updateimage)). A `blob:` URL in the `url` field is also a common pattern (same URL string type as any other image URL); prefer the `image` option when you already have decoded pixels.
5. **Trace on top:** GeoJSON (or other vector) layers above the semi-transparent raster underlay (`raster-opacity`), with draw tools writing geographic coordinates ([`raster-opacity`](https://maplibre.org/maplibre-style-spec/layers/#raster-opacity)).
6. **Persist:** store the four corners (and optional opacity) in `localStorage` / app state; store the image bytes in memory or **IndexedDB**, not `localStorage` ([Web Storage is string-only and quota-limited](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API); [IndexedDB for larger structured data](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)).

**When 4 corners are not enough** (scanned cadastral plans with local bends, historical maps, rubber-sheeting): use a **multi-GCP transform** (affine / projective / polynomial / thin-plate spline) via libraries such as [`@allmaps/transform`](https://allmaps.org/docs/packages/transform/) and render with a **custom / WarpedMap layer** ([`@allmaps/maplibre`](https://allmaps.org/docs/packages/maplibre/)), or pre-warp to a canvas and feed a MapLibre `image`/`canvas` source. That is a larger product step than corner-drag stretch.

**Not recommended as the primary path for this product:** server-side GDAL warping (MapWarper-style), or COG/`raster` tile pipelines—those assume georeferenced rasters or server infrastructure, not a one-shot user PNG/JPG stretch UI.

---

## Code references & implementation plan

### Pick: two references only

| Role                              | Project                                                                                                                       | Why this one                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1 Primary (MapLibre path)**    | [CatCodeDanix/map-image-overlay](https://github.com/CatCodeDanix/map-image-overlay) MIT, npm `map-image-overlay@0.1.0-beta.0` | Only open-source package found that already does **MapLibre `image` source + corner/edge/body drag + `setCoordinates`** with a clean controller/React split. Live demos: [MapLibre](https://CatCodeDanix.github.io/map-image-overlay/demo/maplibre.html), [Mapbox](https://CatCodeDanix.github.io/map-image-overlay/demo/mapbox.html). |
| **#2 Secondary (UX / math only)** | [publiclab/Leaflet.DistortableImage](https://github.com/publiclab/Leaflet.DistortableImage/) (BSD-2 / npm MIT)                | Mature corner-handle product UX (MapKnitter). Shows the same **4-corner state model** and optional **homography** math—but renders via **CSS `matrix3d`**, not MapLibre WebGL. Use as UX inspiration, not as a dependency.                                                                                                             |

**Dropped as a primary reference:** [Mr-Excel’s Mapbox demo](https://github.com/Mr-Excel/mapbox-with-image-overlay-dragable-resizeable) — useful 100-line teaching of “markers → `setCoordinates`”, but map-image-overlay already contains that loop plus edges, body drag, lock/viewer mode, and opacity. No need to build from the demo when #1 exists.

---

### Reference #1 — `map-image-overlay` (core logic map)

**Repo layout that matters:**

| Path                                                                                                                                   | What it does                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/core/ImageOverlayController.ts`](https://github.com/CatCodeDanix/map-image-overlay/blob/main/src/core/ImageOverlayController.ts) | **The engine.** Adds MapLibre/Mapbox `image` + `raster` layers; builds GeoJSON handles; owns mouse drag → new corners → `setCoordinates`. Stateless: you push coords in, listen for `change`. |
| [`src/core/types.ts`](https://github.com/CatCodeDanix/map-image-overlay/blob/main/src/core/types.ts)                                   | `ImageCoords` = four `[lng, lat]` tuples (TL→TR→BR→BL); `ImageOverlayPayload` for locked overlays.                                                                                            |
| [`src/utils/geometry.ts`](https://github.com/CatCodeDanix/map-image-overlay/blob/main/src/utils/geometry.ts)                           | Mercator helpers for **rotate** / **scale** around a centroid (slider UX), not needed for free corner drag.                                                                                   |
| [`src/react/useGeorefManager.ts`](https://github.com/CatCodeDanix/map-image-overlay/blob/main/src/react/useGeorefManager.ts)           | React state machine: add-mode → place image → edit → save/lock; wires controller events into a reducer.                                                                                       |

#### How the stretch loop works

1. **Place an image source** (`initEditorLayers` / `syncViewer`):
   - `map.addSource(..., { type: 'image', url, coordinates })`
   - `map.addLayer(..., { type: 'raster', paint: { 'raster-opacity', 'raster-fade-duration': 0 } })`
2. **Build an edit HUD as GeoJSON** (`generateGeoJson`):
   - 1 transparent **fill** polygon (`type: 'body'`) — drag whole overlay
   - 4 **line** edges (`type: 'edge', index`) — translate an edge (moves two corners)
   - 4 **circle** corners (`type: 'corner', index`) — free-form stretch
3. **On `mousedown`:** `queryRenderedFeatures` on those HUD layers; disable `dragPan`; remember `startPoint` (screen px) and `startCoords` (four corners).
4. **On `mousemove` — the core transforms:**
   - **Corner:** `newCorners[i] = [e.lngLat.lng, e.lngLat.lat]` (direct geographic placement).
   - **Edge / body:** for each affected corner, `project` → add screen `deltaX/deltaY` → `unproject` (keeps motion stable under Mercator).
   - Then: update GeoJSON HUD **and** `imageSource.setCoordinates(newCorners)`.
5. **On `mouseup`:** re-enable pan; emit `change` with `{ corners, isDistorted }` so app state / `localStorage` can persist.
6. **Lock / draw mode:** `syncEditor(null, …)` hides handles; `syncViewer` keeps the raster underlay so vector draw layers can sit above it.

Initial placement when “adding” (`mountNewImage` in the React hook): click map → build a ~200×200 **screen-pixel** rectangle around the click via `project`/`unproject`, then stretch from there. Aspect ratio of the real file is **not** used yet in that hook (hardcoded 100 px half-size)—we should fix that in our app (place using image aspect at a sensible map width).

#### What to reuse vs rewrite

| Reuse as pattern                                              | Be careful / rewrite                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Controller interaction model (GeoJSON HUD + `setCoordinates`) | Package is **`0.1.0-beta.0`**, 0 GitHub stars — treat as **reference / optional spike**, not a long-term vendor lock without review |
| `raster-fade-duration: 0` while dragging                      | Demo add-flow hardcodes a remote GIF URL; we need **blob / `updateImage({ image })`** for local upload                              |
| Edit vs locked viewer separation                              | No IndexedDB; no draw tools; no touch-specific testing documented                                                                   |
| Mercator rotate/scale helpers                                 | Prefer our Zustand (or similar) store over their reducer if we already have app state conventions                                   |

---

### Reference #2 — Leaflet.DistortableImage (what differs)

**Repo layout that matters:**

| Path                                                                                                                                         | What it does                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`src/DistortableImageOverlay.js`](https://github.com/publiclab/Leaflet.DistortableImage/blob/main/src/DistortableImageOverlay.js)           | Holds `_corners[4]`; `setCorner` / `setCorners`; `scaleBy` / `rotateBy` / `dragBy` via `map.project`/`unproject`. |
| [`_reset` + `_calculateProjectiveTransform`](https://github.com/publiclab/Leaflet.DistortableImage/blob/main/src/DistortableImageOverlay.js) | On every view change, computes a **CSS `matrix3d`** that maps image pixel corners → screen corners.               |
| [`src/util/MatrixUtil.js`](https://github.com/publiclab/Leaflet.DistortableImage/blob/main/src/util/MatrixUtil.js)                           | `general2DProjection` — classic 4-point homography (same math family as franklinta’s CSS matrix3d article).       |
| [`src/edit/handles/DistortHandle.js`](https://github.com/publiclab/Leaflet.DistortableImage/blob/main/src/edit/handles/DistortHandle.js)     | Corner drag → `setCorner` → `_reset` (CSS warp).                                                                  |

**Critical difference for MapLibre:** DistortableImage **implements the warp in the DOM** (CSS transform on an `<img>`). MapLibre’s `image` source **already does the texture→quad mapping in WebGL**—so we do **not** port `MatrixUtil` or `_calculateProjectiveTransform` for the overlay itself. We only keep the **interaction model**: store four lat/lng corners, drag them, lock when done.

Steal from DistortableImage UX (not code): select/deselect overlay, opacity toggle, lock mode while tracing, restore-to-initial corners, edge-min-width constraints.

---

### Recommendation for geometrie-nachzeichnen

**Implement our own thin overlay editor on MapLibre**, modeled on **map-image-overlay’s controller**, do **not** adopt Leaflet.DistortableImage as a runtime dependency, and **do not** start from the Mr-Excel HTML demo except as a 5-minute mental model.

#### Plan

1. **Spike (½–1 day):** Open the [MapLibre live demo](https://CatCodeDanix.github.io/map-image-overlay/demo/maplibre.html); skim `ImageOverlayController.ts`. Optionally `npm i map-image-overlay@0.1.0-beta.0` in a throwaway branch to validate peer deps with our MapLibre version—or copy only the controller file (MIT) into `src/` and adapt.
2. **MVP overlay module (own code):**
   - Upload `File` → `createImageBitmap` / blob URL → `addSource({ type: 'image' })` or `updateImage({ image })`.
   - Seed four corners from click + **image aspect ratio** (improve on their square default).
   - GeoJSON corner (+ optional edge/body) handles → `setCoordinates` on drag.
   - Opacity slider; “Lock / Fertig” hides handles.
3. **State:** Zustand (or existing store) holds `{ corners, opacity, locked }`; persist corners (+ opacity) to `localStorage`; image bytes memory / IndexedDB.
4. **Draw phase:** With overlay locked, enable GeoJSON draw tools above the semi-transparent raster (`raster-opacity` ~0.5–0.7). Flat map (`pitch: 0`) for tracing.
5. **Do not build yet:** Allmaps multi-GCP rubber-sheeting, CSS overlays, server MapWarper. Revisit only if 4-corner fit fails on real Flurkarten.

#### Decision summary

| Option                                                    | Verdict                                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Depend on `map-image-overlay` long-term                   | **Maybe after spike**; prefer vendoring/adapting core if API/stability feels thin |
| Copy patterns from `ImageOverlayController` into our code | **Yes — recommended default**                                                     |
| Use Leaflet.DistortableImage                              | **No** (wrong renderer); UX ideas only                                            |
| Use Allmaps for MVP                                       | **No** (overkill for 4-corner stretch)                                            |
| Mr-Excel demo                                             | **Skip** except as minimal illustration                                           |

---

## MapLibre APIs

### `image` source + `raster` layer (primary)

Style Spec: an `image` source has a `url` and `coordinates`—four `[longitude, latitude]` pairs in **clockwise** order: **top left, top right, bottom right, bottom left** ([Sources – image](https://maplibre.org/maplibre-style-spec/sources/#image)).

Runtime API (`ImageSource`):

| Method                                        | Role                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setCoordinates(coordinates)`                 | Move / stretch the overlay; corners need not be a rectangle ([docs](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#setcoordinates))                |
| `updateImage({ url \| image, coordinates? })` | Swap image and optionally coordinates; use `image` for already-decoded pixels ([docs](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#updateimage)) |

Official example pattern (radar animation): add `type: 'image'` source, `type: 'raster'` layer, then `updateImage` / coordinate updates; set `'raster-fade-duration': 0` to avoid flash when updating ([Animate a series of images](https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-series-of-images/)).

Illustrative setup (coordinates and opacity from official docs / style spec):

```js
map.addSource('plan', {
  type: 'image',
  url: blobUrl, // or omit and use updateImage({ image }) after add
  coordinates: [
    [lngTL, latTL],
    [lngTR, latTR],
    [lngBR, latBR],
    [lngBL, latBL],
  ],
})

map.addLayer({
  id: 'plan-raster',
  type: 'raster',
  source: 'plan',
  paint: {
    'raster-opacity': 0.6,
    'raster-fade-duration': 0,
  },
})

// Stretch UI: on corner drag
map.getSource('plan').setCoordinates(nextFourCorners)
```

**Note:** MapLibre’s example titled [“Add a stretchable image to the map”](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-stretchable-image-to-the-map/) is about **sprite / icon nine-slice stretch** (`map.addImage` + `stretchX` / `stretchY`), **not** geographic image overlays. Do not confuse it with `image` sources.

### Image source vs `raster` / `raster-dem` / custom layers

| Mechanism                  | What it is                                                                                                                                                                                                            | Fit for user-upload stretch                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **`image` source**         | Single image texture placed by 4 geographic corners; rendered via a **`raster` layer**                                                                                                                                | **Primary fit** for plan/photo overlays                               |
| **`raster` source**        | XYZ/WMS **tile** pyramid ([Style Spec](https://maplibre.org/maplibre-style-spec/sources/#raster))                                                                                                                     | Needs tileserver / COG protocol; not a simple upload                  |
| **`raster-dem`**           | Terrain RGB DEM tiles                                                                                                                                                                                                 | Unrelated to plan overlays                                            |
| **`video` source**         | Same 4-corner model as image ([Style Spec](https://maplibre.org/maplibre-style-spec/sources/#video))                                                                                                                  | Same stretch model; video instead of still                            |
| **`canvas` source**        | HTML canvas contents + 4 corners ([`CanvasSource`](https://maplibre.org/maplibre-gl-js/docs/API/classes/CanvasSource/), [spec](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/)) | Useful if you **pre-warp** pixels in 2D canvas, then place the result |
| **`CustomLayerInterface`** | Draw directly into the map WebGL context ([docs](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/))                                                                                      | Used by Allmaps MapLibre plugin for multi-GCP warping                 |

### Opacity, blend, z-order for tracing

- **Opacity:** `raster-opacity` on the raster layer (0–1) ([Style Spec](https://maplibre.org/maplibre-style-spec/layers/#raster-opacity)).
- **Other paint knobs:** `raster-brightness-*`, `raster-saturation`, `raster-contrast`, resampling ([raster paint](https://maplibre.org/maplibre-style-spec/layers/#raster)).
- **Z-order:** layer order in the style; add the image raster **below** GeoJSON fill/line/circle layers used for drawing. Use `map.moveLayer` / `addLayer(..., beforeId)` as needed (MapLibre Map API).
- **Fade while editing coordinates:** set `raster-fade-duration` to `0` when updating often ([ImageSource docs](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#updateimage); [animate example](https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-series-of-images/)).

### Interactive corner handles (MapLibre-native pattern)

MapLibre does not ship built-in “image corner handles.” The established pattern:

1. Keep four coordinates in app state.
2. Render four draggable points ([Create a draggable point](https://www.maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/) or HTML Markers).
3. On move, update the corresponding corner and call `setCoordinates`.

Third-party wrappers that encode this UX for MapLibre/Mapbox:

- [CatCodeDanix/map-image-overlay](https://github.com/CatCodeDanix/map-image-overlay) — corner drag / rotate / scale for MapLibre ≥ 3 and Mapbox ≥ 2 (small/new project; evaluate maturity before depending on it).
- [Mr-Excel/mapbox-with-image-overlay-dragable-resizeable](https://github.com/Mr-Excel/mapbox-with-image-overlay-dragable-resizeable) — demo: image source + corner markers + drag/resize.

---

## Transform models and UX

### What MapLibre’s 4 corners actually do

`setCoordinates` maps the image’s four corners to four geographic positions. Official docs state corners **do not have to represent a rectangle** ([`setCoordinates`](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/#setcoordinates)). That enables a **projective-style / free-quad** placement: drag corners independently to stretch, skew, and fit a rectangular plan image onto a non-axis-aligned footprint.

**Is 4-corner enough for “stretch to fit”?**

- **Yes** for: floor plans, roughly rectangular scans, photos of plans that should align to a parcel footprint, quick cadastral overlay where local deformation is negligible.
- **No** (or incomplete) for: historical maps with curved distortions, rubber-sheet needs, many irregular GCPs, or when interior features must snap independently of the corners—then you need multi-GCP transforms and a warping renderer.

Mathematically, four point correspondences determine a **homography / projective** transform between two planes. Libraries such as [perspective-transform](https://www.npmjs.com/package/perspective-transform) and [Homography.js](https://github.com/Eric-Canas/Homography.js) compute/apply that in JS; MapLibre’s image source applies an equivalent **texture-to-quad** placement in the map’s WebGL pipeline (implementation detail: corner coords → mercator tile space in [`image_source.ts`](https://github.com/maplibre/maplibre-gl-js/blob/main/src/source/image_source.ts)).

### Affine vs projective vs more GCPs

Summary aligned with [`@allmaps/transform` transformation types](https://allmaps.org/docs/packages/transform/) (min GCPs from their docs table):

| Model                                | Typical min GCPs   | UX it enables                    | Notes                                                  |
| ------------------------------------ | ------------------ | -------------------------------- | ------------------------------------------------------ |
| **Helmert / similarity**             | 2                  | Translate, rotate, uniform scale | Shape-preserving; limited stretch                      |
| **1st-order polynomial (affine)**    | 3                  | Translate, rotate, scale, shear  | Parallel lines stay parallel                           |
| **Projective**                       | 4                  | Full quad stretch / perspective  | Matches MapLibre 4-corner model well                   |
| **Polynomial 2 / 3**                 | 6 / 10             | Mild / stronger bending          | Needs more user picks                                  |
| **Thin Plate Spline (rubber sheet)** | 3+ (more = better) | Local pull-to-fit at each GCP    | Exact at GCPs; Allmaps default ecosystem supports this |

**User-facing patterns:**

1. **Corner handles on the map (4 points)** — fastest; image already on the basemap; drag corners until features align. Closest to MapLibre `image` source.
2. **Side-by-side GCP picking** — left: source image; right: basemap; click corresponding features (MapWarper / Allmaps Editor). Scales to many GCPs; better for rubber-sheeting.
3. **Hybrid** — rough 4-corner place on map, then refine with extra GCPs and a warp renderer.

### Browser libraries that compute transforms from control points

| Library                                                                                                                 | Role                                                                                                                                                                                                                                                                               | License / notes                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`@allmaps/transform`](https://allmaps.org/docs/packages/transform/)                                                    | GCP → helmert / polynomial / projective / thinPlateSpline; MIT packages                                                                                                                                                                                                            | Best geospatial-oriented option; pairs with `@allmaps/render` / MapLibre plugin |
| [perspective-transform](https://www.npmjs.com/package/perspective-transform)                                            | 4↔4 quad homography                                                                                                                                                                                                                                                                | Lightweight; not map-specific                                                   |
| [Homography.js](https://github.com/Eric-Canas/Homography.js) / [`homography`](https://www.npmjs.com/package/homography) | Affine / projective / piecewise affine image warps                                                                                                                                                                                                                                 | Good for warping pixels to canvas before overlay                                |
| OpenLayers + custom affine                                                                                              | OL `ImageStatic` is **axis-aligned extent** only ([API](https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic-Static.html)); community patterns use `addCoordinateTransforms` for affine ([discussion](https://github.com/openlayers/openlayers/discussions/15811)) | Useful reference; not MapLibre                                                  |

---

## Survey of open-source apps & tools

| Name                                      | URL                                                                                                                                                                                                                                                           | User-facing flow                                                                                         | Technical approach                                                            | Relevance                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **MapLibre `image` source**               | [Style Spec](https://maplibre.org/maplibre-style-spec/sources/#image), [ImageSource API](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/), [animate example](https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-series-of-images/) | Developer places image with 4 corners; no built-in handles                                               | WebGL texture + 4 geo corners via `raster` layer                              | **Core API for this project**                                                                                                             |
| **map-image-overlay**                     | [GitHub](https://github.com/CatCodeDanix/map-image-overlay)                                                                                                                                                                                                   | Edit mode: free-form corner drag, rotate, scale; opacity / multi-layer                                   | Stateless controller on MapLibre/Mapbox image coordinates                     | Closest ready-made MapLibre stretch UX; verify maturity                                                                                   |
| **Mapbox image overlay drag demo**        | [GitHub](https://github.com/Mr-Excel/mapbox-with-image-overlay-dragable-resizeable)                                                                                                                                                                           | Markers on corners; drag image / resize                                                                  | `image` source + `setCoordinates` + markers                                   | Pattern to copy in MapLibre                                                                                                               |
| **Allmaps Editor**                        | [editor.allmaps.org](https://editor.allmaps.org/), [allmaps.org](https://allmaps.org/), [workshop notes](https://pages.allmaps.org/workshops/2023-iiif-online-meeting.html)                                                                                   | Paste IIIF URL → mask → **side-by-side** image + world map → pick GCPs → auto-save annotation            | IIIF Georeference Annotations; WebGL warp; no GIS tile bake                   | **Gold-standard GCP UX**; packages MIT, apps GPL-3.0 ([repo](https://github.com/allmaps/allmaps/)); IIIF-centric (adapt for local upload) |
| **`@allmaps/maplibre`**                   | [docs](https://allmaps.org/docs/packages/maplibre/)                                                                                                                                                                                                           | Display warped maps on MapLibre                                                                          | `CustomLayerInterface` `WarpedMapLayer`; **no pitch** (`maxPitch: 0`)         | Use if multi-GCP warp needed on MapLibre                                                                                                  |
| **IIIF Georeference Extension**           | [iiif.io/api/extension/georef](https://iiif.io/api/extension/georef/)                                                                                                                                                                                         | Spec for GCPs + resource ↔ geo links as Web Annotations                                                  | Lightweight JSON instead of GeoTIFF derivatives                               | Good persistence format inspiration for GCP state                                                                                         |
| **MapWarper / mapwarper.net**             | [mapwarper.net](https://mapwarper.net/), [timwaters/mapwarper](https://github.com/timwaters/mapwarper/) (MIT)                                                                                                                                                 | Upload map → **Rectify**: dual panes → place control points → server warp → tiles/GeoTIFF/WMS            | Rails + GDAL + PostGIS + MapServer/GeoServer                                  | Classic UX to learn from; **server-side**—not browser-only                                                                                |
| **NYPL Map Warper**                       | [NYPL project page](https://www.nypl.org/digital-research/projects/map-warper) (archived 2021), [nypl-warper](https://github.com/nypl-spacetime/nypl-warper)                                                                                                  | Same MapWarper-style GCP dual-pane for library maps                                                      | Fork of MapWarper stack                                                       | UX ancestry; archived as a service                                                                                                        |
| **Kartta Labs mapwarper**                 | [kartta-labs/mapwarper](https://github.com/kartta-labs/mapwarper/) (MIT)                                                                                                                                                                                      | Same georectify + digitize narrative                                                                     | Cloud/K8s-oriented MapWarper fork                                             | Same technique family                                                                                                                     |
| **MapKnitter + Leaflet.DistortableImage** | [mapknitter.org](http://mapknitter.org) / [mapknitter](https://github.com/publiclab/mapknitter) (GPL-3.0), [Leaflet.DistortableImage](https://github.com/publiclab/Leaflet.DistortableImage/) (BSD-2 / npm MIT)                                               | Aerial photos on map; **distort / drag / rotate / scale** via corner handles; opacity toggle             | Client-side **CSS3** perspectival distortion over Leaflet                     | **Best UX reference for corner-handle stretch**; Leaflet/DOM, not MapLibre WebGL                                                          |
| **Leaflet `ImageOverlay`**                | [Leaflet docs](https://leafletjs.com/reference.html#imageoverlay)                                                                                                                                                                                             | Bounds-based image on map                                                                                | Axis-aligned geographic bounds (simpler than free quad)                       | Ancestor of overlay idea; less flexible than MapLibre 4 corners                                                                           |
| **leaflet-imageoverlay-gcp**              | [frogcat/leaflet-imageoverlay-gcp](https://github.com/frogcat/leaflet-imageoverlay-gcp)                                                                                                                                                                       | Overlay from list of `{imagePoint, latlng}` GCPs                                                         | Leaflet plugin; updatable GCPs                                                | Shows GCP→overlay API shape                                                                                                               |
| **OpenLayers `ImageStatic`**              | [API](https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic-Static.html)                                                                                                                                                                       | Place image by `imageExtent` [left, bottom, right, top]                                                  | No native free-quad / rotation in the source itself                           | Contrast: OL extent vs MapLibre corners                                                                                                   |
| **geotiff.js + MapLibre COG**             | [geomatico/maplibre-cog-protocol](https://github.com/geomatico/maplibre-cog-protocol), [georaster-layer-for-leaflet](https://github.com/GeoTIFF/georaster-layer-for-leaflet)                                                                                  | Load already-georeferenced GeoTIFF/COG as tiles/layer                                                    | Range-request COG; not interactive stretch of a JPG                           | Relevant only if input is a GeoTIFF, not a plain scan                                                                                     |
| **OSM iD editor**                         | [iD API.md](https://github.com/openstreetmap/iD/blob/master/API.md), [LearnOSM](https://learnosm.org/en/beginner/id-editor/)                                                                                                                                  | Trace vectors over **TMS/WMS imagery**; opacity & **imagery offset** (shift only); custom background URL | Tile backgrounds; Mapillary etc. as photo overlays—not arbitrary image georef | Tracing UX (draw over basemap/imagery); **not** local image warp                                                                          |
| **JOSM imagery offset**                   | (desktop)                                                                                                                                                                                                                                                     | Nudge imagery                                                                                            | Offset only                                                                   | Web-relevant only as “shift underlay” pattern; not stretch                                                                                |

**Takeaway for geometrie-nachzeichnen:** see [Code references & implementation plan](#code-references--implementation-plan). Short version: implement MapLibre `image` + `setCoordinates` following **map-image-overlay**; steal UX ideas from **DistortableImage**; skip Allmaps/MapWarper until 4 corners fail.

---

## Drawing over the image

### Common pattern

1. Basemap (vector/raster style).
2. Semi-transparent **plan image** (`raster-opacity` ~0.4–0.8).
3. **Vector draw layer** (GeoJSON source + line/fill/circle) on top.
4. Optional: dim or hide handles while drawing; lock coordinates after “Fit” confirmation.

This matches OSM digitizing (trace over imagery) and MapWarper’s “Digitizer” idea (trace after rectify)—see [MapWarper README](https://github.com/timwaters/mapwarper/).

### Map layer vs HTML/canvas overlay

| Approach                                   | Pros                                                                                                     | Cons                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MapLibre `image` / `canvas` source**     | Stays in map CRS; pans/zooms/pitch with map; same hit-testing/coords as drawn GeoJSON; opacity via paint | Limited to 4-corner (or pre-warped canvas); known edge cases with terrain/DEM ([issue discussion](https://github.com/maplibre/maplibre-gl-js/issues/5149)) |
| **Allmaps custom layer**                   | True multi-GCP warp in WebGL                                                                             | Pitch unsupported; IIIF-oriented; heavier stack                                                                                                            |
| **HTML `<img>` / canvas over the map div** | Easy CSS transforms                                                                                      | Easy to desync from map projection on rotate/pitch/zoom; harder tracing accuracy                                                                           |
| **Leaflet.DistortableImage (DOM)**         | Excellent edit UX                                                                                        | Different map stack; CSS3 vs WebGL                                                                                                                         |

**Recommendation for tracing accuracy:** keep the image as a **map layer** so drawn vertices and the underlay share the same camera and projection. Use HTML overlays only for handles UI if needed—not for the georeferenced image itself.

---

## Client-only storage model

| Data                                   | Where                                                                                                                                                                                                                        | Why                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Image bytes**                        | Memory (`File` / `Blob` / `ImageBitmap`); optional **IndexedDB** for session restore                                                                                                                                         | Images are large binary; Web Storage stores **strings only** and is quota-sensitive ([MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API)); IndexedDB is designed for larger structured/binary data ([MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)) |
| **Display URL**                        | `URL.createObjectURL(blob)` while on screen; **`revokeObjectURL`** when done ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static))                                                            | Blob URLs are not durable across sessions and hold memory                                                                                                                                                                                                                                                                                                      |
| **Four corners / opacity / lock flag** | React/Zustand (or similar) + **`localStorage` JSON**                                                                                                                                                                         | Small, stringifiable; survives reload without re-picking stretch                                                                                                                                                                                                                                                                                               |
| **GCP list (if multi-point)**          | `localStorage` or IndexedDB JSON (Allmaps-style annotation shape is a good template—[Georeference Extension](https://iiif.io/api/extension/georef/), [`@allmaps/annotation`](https://allmaps.org/docs/packages/annotation/)) | Small metadata; can restore warp without re-upload **if image is also in IndexedDB**                                                                                                                                                                                                                                                                           |

**Persist transform without re-uploading:** on reload, read corners from `localStorage`, read image from IndexedDB (or ask user to re-select the file if you skip IndexedDB), then `addSource` / `updateImage({ image })` + `setCoordinates`. Do **not** put base64 images in `localStorage` (quota / performance).

**Privacy:** keeping the plan in-browser matches the product constraint; document that IndexedDB persistence is still local to the origin/device.

---

## Open questions / risks for this project

1. **Quad distortion quality:** MapLibre documents non-rectangular corners, but extreme quads / self-intersecting orders may look wrong (`flippedWindingOrder` exists in source). Validate with skewed cadastral plans early ([`image_source.ts`](https://github.com/maplibre/maplibre-gl-js/blob/main/src/source/image_source.ts)).
2. **Terrain / pitch:** image overlays have reported issues with raster-DEM / terrain ([#5149](https://github.com/maplibre/maplibre-gl-js/issues/5149)); Allmaps MapLibre explicitly disables pitch. Prefer flat 2D map for tracing.
3. **Large scans:** multi‑megapixel images as a single texture may hit GPU / memory limits—consider downscaling for overlay while keeping original for export.
4. **4 corners vs real GCP needs:** German cadastral / “Flurkarte” scans sometimes need local rubber-sheeting; decide MVP (corners only) vs Allmaps-style warp.
5. **Blob URL lifetime:** revoked or session-expired blob URLs break the source; prefer `updateImage({ image })` + IndexedDB for restore.
6. **Third-party MapLibre overlay editors:** `map-image-overlay` is young (low stars); treat as inspiration or vendor carefully.
7. **Licensing if adopting Allmaps apps vs packages:** packages MIT; Editor/Viewer apps GPL-3.0 ([Allmaps license notes](https://github.com/allmaps/allmaps/)).
8. **Uncertainty:** exact internal interpolation of MapLibre’s non-rectangular image mapping is not spelled out as “homography” in the public API docs—behavior should be verified empirically for your plan types rather than assumed identical to GDAL warps.

---

## Sources

### MapLibre (primary)

- [Sources – Style Spec (`image`, `raster`, `video`, …)](https://maplibre.org/maplibre-style-spec/sources/)
- [Layers – raster paint (`raster-opacity`, `raster-fade-duration`, …)](https://maplibre.org/maplibre-style-spec/layers/#raster)
- [ImageSource API](https://maplibre.org/maplibre-gl-js/docs/API/classes/ImageSource/)
- [UpdateImageOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/UpdateImageOptions/)
- [CanvasSource API](https://maplibre.org/maplibre-gl-js/docs/API/classes/CanvasSource/)
- [CanvasSourceSpecification](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CanvasSourceSpecification/)
- [CustomLayerInterface](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/)
- [Animate a series of images](https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-series-of-images/)
- [Create a draggable point](https://www.maplibre.org/maplibre-gl-js/docs/examples/create-a-draggable-point/)
- [image_source.ts (implementation)](https://github.com/maplibre/maplibre-gl-js/blob/main/src/source/image_source.ts)

### Georeferencing / transforms

- [Allmaps](https://allmaps.org/) · [Editor](https://editor.allmaps.org/) · [GitHub monorepo](https://github.com/allmaps/allmaps/)
- [`@allmaps/maplibre`](https://allmaps.org/docs/packages/maplibre/)
- [`@allmaps/transform`](https://allmaps.org/docs/packages/transform/)
- [`@allmaps/annotation`](https://allmaps.org/docs/packages/annotation/)
- [IIIF Georeference Extension](https://iiif.io/api/extension/georef/)
- [perspective-transform (npm)](https://www.npmjs.com/package/perspective-transform)
- [Homography.js](https://github.com/Eric-Canas/Homography.js)

### Apps & plugins (UX survey)

- [mapwarper.net](https://mapwarper.net/) · [timwaters/mapwarper](https://github.com/timwaters/mapwarper/)
- [NYPL Map Warper (archived)](https://www.nypl.org/digital-research/projects/map-warper)
- [Programming Historian – Introduction to Map Warper](https://programminghistorian.org/en/lessons/introduction-map-warper)
- [Leaflet.DistortableImage](https://github.com/publiclab/Leaflet.DistortableImage/) · [MapKnitter](https://github.com/publiclab/mapknitter)
- [leaflet-imageoverlay-gcp](https://github.com/frogcat/leaflet-imageoverlay-gcp)
- [Leaflet ImageOverlay](https://leafletjs.com/reference.html#imageoverlay)
- [OpenLayers ImageStatic](https://openlayers.org/en/latest/apidoc/module-ol_source_ImageStatic-Static.html)
- [map-image-overlay](https://github.com/CatCodeDanix/map-image-overlay)
- [mapbox-with-image-overlay-dragable-resizeable](https://github.com/Mr-Excel/mapbox-with-image-overlay-dragable-resizeable)
- [maplibre-cog-protocol](https://github.com/geomatico/maplibre-cog-protocol)
- [iD editor API (background / imagery)](https://github.com/openstreetmap/iD/blob/master/API.md)
- [Allmaps Editor workshop (GCP UX)](https://pages.allmaps.org/workshops/2023-iiif-online-meeting.html)

### Browser storage

- [MDN – Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API)
- [MDN – Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [MDN – `URL.createObjectURL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
