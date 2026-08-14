# Explore: vector tiles as routing graph source (vs Overpass)

Research date: 2026-08-12. Status: **near-future exploration** — not planned for the current Overpass → `route-snapper` path.

**Audience:** product / engineering deciding whether basemap or dedicated routing tiles can replace Overpass for snapped route drawing.

---

## 1. Executive summary

### Verdict: **promising data-source swap, not a free win from the painted basemap**

OpenMapTiles-compatible vector tiles (OpenFreeMap, MapTiler OMT, etc.) **can** supply a road network for client-side snapping and routing. Libraries such as [omt-router](https://github.com/AbelVM/omt-router) already build graphs from the `transportation` layer and snap endpoints in the browser.

For Route Tracer, that would mainly buy:

- CDN-style incremental loads (no Overpass rate limits / XML merge)
- A clearer path to swap the **tile URL** later (e.g. future TILDA routing tiles), _if_ the schema stays compatible

It does **not** mean we can reuse MapLibre’s already-rendered features as a graph for free, and it is **not** a drop-in for today’s pipeline:

```text
Overpass highway XML  →  @osm-editor-kit/osm-route-snapper  →  route-snapper WASM
```

**Recommendation:** keep Overpass for the current product; treat tile-backed graph build as a deliberate near-future spike with an explicit schema contract and a graph-build abstraction.

---

## 2. Current app (baseline)

| Piece          | Today                                                                |
| -------------- | -------------------------------------------------------------------- |
| Basemap        | OpenFreeMap Positron (`OPENFREEMAP_POSITRON_STYLE`) — OMT-compatible |
| MapTiler       | Geocoding only, not basemap tiles                                    |
| Network load   | Overpass highways for viewport coverage at zoom ≥ 15 (`viewMinZoom`) |
| Coverage       | `@osm-editor-kit/osm-coverage` + IndexedDB session cache             |
| Graph          | `@osm-editor-kit/osm-route-snapper` → `graphBytes`                   |
| Draw / snap UX | `route-snapper-ts` `RouteTool`                                       |
| Export         | Geometry-first segments; optional `osm_way_ids` deferred             |

User-facing overview: [`README.md`](../README.md). Sibling research on the A/B Street / Overpass stack: [`abstreet-routing-overpass-interactive.md`](./abstreet-routing-overpass-interactive.md).

---

## 3. Why tiles look attractive

1. **Same network family as the basemap** — roads the user sees are already in MVT form somewhere.
2. **Operational simplicity** — slippy-map tiles, HTTP cache, no Overpass 429s or growing bbox XML merges.
3. **Provider swap story** — if TILDA later ships **routing-oriented** tiles with a known layer schema, changing the tile template might be enough _for the data plane_.
4. **Proven existence proof** — omt-router routes on OpenFreeMap / MapTiler OMT tiles entirely client-side.

---

## 4. Why it is not “just use the basemap”

### 4.1 MapLibre does not expose a ready graph

`querySourceFeatures` / `queryRenderedFeatures`:

- Return **clipped fragments** and duplicates at tile seams
- Only cover **currently loaded** tiles
- Are not a connected node/edge model

Serious tile routers re-fetch and decode MVT (often in workers), stitch boundaries, then build a graph. The painted map is a consumer of tiles, not a routing API.

### 4.2 Display tiles ≠ OSM extract

| Aspect   | Overpass → route-snapper       | OMT / basemap `transportation`                             |
| -------- | ------------------------------ | ---------------------------------------------------------- |
| Topology | Real OSM node/way connectivity | Reconstructed from clipped lines                           |
| Geometry | Full ways                      | Zoom-dependent simplification; tile cuts                   |
| IDs      | Stable OSM way IDs             | Often min/`osm_id`; merges at lower zooms                  |
| Tags     | Full queryable tags            | Schema subset (`class`, brunnel, oneway/access if present) |
| UX fit   | Feeds current `RouteTool`      | Needs MVT → `RouteSnapperMap` **or** a different router    |

Snap quality for sketching can be **good enough** at high zoom (z14–z15+), especially with careful boundary stitching (e.g. Liang–Barsky / bit-identical edge nodes as in omt-router). It will not match Overpass fidelity for topology or way-level export.

### 4.3 Stack cost

Either:

- **A.** Build `MVT transportation → RouteSnapperMap` (or equivalent bytes) and keep `route-snapper` draw/drag UX, or
- **B.** Replace pathfinding/UX with a tile-native router (e.g. omt-router) and reimplement multi-waypoint drag / freehand / segment export.

Option A preserves product UX; option B is a larger rewrite.

---

## 5. TILDA routing tiles later

Switching providers is easy **only if** the replacement tiles are a compatible **road network** source — not merely another MapLibre style.

- Today’s TILDA atlas tiles are mostly **thematic** (bike infra, parking, etc.), not a drop-in planet-scale routable street graph like OpenFreeMap/MapTiler OMT.
- A future “TILDA routing tiles” product would need a documented contract: layer name(s), min zoom for full geometry, feature IDs, oneway/access, and rules against destructive merges of ways we snap to.

**Abstraction that keeps the swap cheap:**

```text
tile URL + layer schema  →  RouteSnapperMap bytes  →  RouteTool
```

(or a thin router interface with the same export/segment semantics). Do **not** hard-wire MapTiler-specific URLs or assume “any vector basemap” works.

Overpass can remain an alternate backend behind the same graph-bytes boundary.

---

## 6. Proposed exploration (near future)

### Spike goals

1. Confirm snap quality at z14 vs z15 on OpenFreeMap (and optionally MapTiler OMT) for a dense German urban area and a rural fringe.
2. Prototype **tile fetch → stitched line graph → `RouteSnapperMap`** (or measure effort if that conversion is impractical).
3. Compare seam failures, missing service/paths, and snap distance vs current Overpass graph on the same viewport.
4. Decide whether `osm_way_ids` stay optional/deferred under a tile source (likely weaker IDs).
5. Write a one-page **schema contract** any future TILDA routing tiles must meet.

### Non-goals for the spike

- Replacing Overpass in production
- Reusing `querySourceFeatures` as the sole data path
- Full turn restrictions / navigation-grade costing (product is sketching, not turn-by-turn)

### Suggested order of work

1. Spike omt-router (or equivalent) against the same OpenFreeMap tiles the basemap uses — quality / CORS / zoom only.
2. If quality is acceptable, design MVT → route-snapper graph conversion (keep `RouteTool`).
3. Only then sketch a provider interface (`getGraphForBounds`) with Overpass and tiles as backends.
4. Revisit when TILDA routing tiles have a concrete schema or endpoint.

### Exit criteria

| Result                                                                            | Next step                                                      |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Snaps match Overpass well enough at z≥15; conversion to route-snapper is feasible | Schedule a backend swap behind `getGraphForBounds`             |
| Geometry OK but conversion too hard                                               | Park or consider tile-native router + UX rewrite (high cost)   |
| Seams / missing classes / weak IDs unacceptable                                   | Keep Overpass; optionally use tiles only for highlight / debug |

---

## 7. References

- Current coverage + graph wiring: `src/shared/routing/osm-coverage-query.ts`, `src/shared/routing/route-snapper-query.ts`
- OpenMapTiles `transportation` schema: https://openmaptiles.org/schema/#transportation
- [omt-router](https://github.com/AbelVM/omt-router) — client-side routing from OMT tiles (AGPL-3.0; check license before product use)
- OpenFreeMap tile metadata example: https://tiles.openfreemap.org/planet
- MapLibre feature query limitations (clipped / duplicated features): MapLibre / Mapbox `querySourceFeatures` docs and related issues
- Sibling research: [`abstreet-routing-overpass-interactive.md`](./abstreet-routing-overpass-interactive.md)
