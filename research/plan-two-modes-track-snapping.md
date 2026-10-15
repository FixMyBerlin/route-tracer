# Plan: two modes — trace an image, or snap a track

Status: implemented on branch `track-snapping`, 2026-10-16. Decisions in section 7, what differs from the plan in section 8.

Both modes end with the same thing: one route geometry made of snapped and freehand stretches, which the user can edit and export.

```
Image mode:  image  → align → draw (snap / freehand) → export
Track mode:  upload → auto-snap → review + adjust     → export
```

## 1. What we learned (research summary)

- **Dustin's route appraisal tool** (`dustin-route-appraisal`, Rust/WASM + Svelte) imports GeoJSON lines, not GPX.
  - Matching (`backend/src/import.rs`): buffer the input line by 70 m, keep only roads inside the buffer, snap start and end to nearby roads, run A\* by length, then greedily drop intermediate intersections as long as re-routing yields the same path (`find_minimal_waypoints`). No HMM.
  - It stores **only waypoints**, never geometry or OSM way IDs. A snapped waypoint is `[lon, lat]`; a freehand one is `{point, freehand: true, crossings}`. Opening a project re-routes them on the current graph, silently.
  - Review UX: a dev-only trace mode with a red/green list, `n` jumps to the next open item, and drag/click/right-click on waypoint markers.
- **TILDA plans** (`tilda-geo--infravelo/.cursor/plans/infravelo-netzabgleich.md` §6.7; route-matching plan in `~/.cursor/plans/route_matching_mode_*.plan.md`):
  - Adopt: store waypoints next to the result, keep waypoints minimal, add a cheap quality measure per section, and use per-section review.
  - Reject: silent re-routing ("keine Automagie").
  - The TILDA glossary says "Wegpunkte"/`waypoints`, not "Stützpunkte". This plan uses _waypoints_.
- **route-snapper** already has what auto-snap needs: `calculateRoute(waypoints)` returns the full route feature for a waypoint list without user interaction. It is marked experimental.

## 2. Storage pattern

The plan separates three layers: the **source** (what the user brought), the **decisions** (what the user or the matcher decided), and the **result** (what we compute from both).

| Layer     | Content                                                                                                           | Where                                                                                                                                          | Size                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Source    | Image (as today), or the uploaded track kept unchanged                                                            | IndexedDB, key in the URL (`imageId` / `trackId`), optional remote URL (`imageSource` / `trackSource`); the exported GeoJSON carries the track | Track: ~1.6 KB per 5 km in lz-string |
| Decisions | Waypoints `[lon, lat, flags]`; flags = snapped/freehand and pinned (set by the user) vs auto (set by the matcher) | URL `route` (v2)                                                                                                                               | ~180 chars for 10 waypoints          |
| Result    | Geometry stretches (snapped/freehand, optional way IDs) and the length of each section                            | Computed whenever roads are loaded; exported as GeoJSON; per-section lengths in the URL for change detection                                   | Today ~8 KB in the URL for 5 km      |

Why:

- **Waypoints instead of geometry in the URL.**
  - Size: today the URL stores every route vertex, about one every 5 m on the densified graph. In a quick estimate, a 5 km route is about 8 KB of URL; ten waypoints are under 200 characters.
  - It fixes a current bug: today a reload keeps only the ends of each stretch, so intermediate snapped clicks merge.
  - It is the same model as Dustin's tool and route-snapper's native format.
- **Pinned vs auto waypoints.** These flags make "re-snap later based on those decisions" possible. A re-match from the source track recomputes the auto waypoints and keeps every waypoint the user placed or moved.
- **The export is self-contained.** The GeoJSON contains:
  - the geometry;
  - `waypoints` (with flags) in the properties;
  - a reference to the source;
  - optionally the source track as a second feature.

  Re-importing an exported file recognises the `waypoints` property and skips matching, the same way Dustin replays `traced_waypoints`.

- **Old URLs still open.** `route` v1 (segments) still decodes and is converted to waypoints once.

## 3. Re-snapping later

Re-snapping can happen in two ways:

1. **Replay (default when a URL or exported file is opened):**
   - load roads and run `calculateRoute(waypoints)`;
   - compare each section's length with the stored length;
   - sections that changed are highlighted, with "was 412 m, now 455 m", for the user to confirm. No silent change.
2. **Re-match:**
   - run auto-snap again on the source track, keeping the pinned waypoints as fixed points;
   - used when the source track changed or the matcher got better;
   - needs the source track (IndexedDB, the URL or the exported file).

## 4. Auto-snap (track mode)

Pure functions, unit-tested against a fixture graph:

1. **Parse.**
   - GPX `trk`/`trkseg`/`rte` with `DOMParser` (no dependency needed).
   - GeoJSON LineString, MultiLineString, Feature or FeatureCollection.
   - Drop duplicates, then simplify by about 3 m to remove GPS jitter.
2. **Load roads along the track.**
   - Split the track into pieces of about 1–2 km, buffer each by about 50 m, and call `ensureCoverage` per piece. It already skips what is cached.
   - The centred prompt says how many requests this will make (be mindful of Overpass).
   - A cleaner home for this is an `ensureCoverageAlongLine` in `@osm-editor-kit/osm-coverage`.
3. **Candidate waypoints.**
   - Sample the track about every 150 m, plus at sharp turns.
   - Snap each sample to the nearest graph node within about 25 m (reuse `nearest-road-point.ts`).
   - If no road is within reach, that part of the track becomes a **freehand stretch that follows the track itself** (for parks and paths missing from OSM) and is flagged.
4. **Route.** Run `calculateRoute` over the candidates.
5. **Score each section.** Compute the maximum distance between the track and the route in both directions. Sections over about 20 m are flagged as "check here". This catches the classic case where the matcher picks the road instead of the cycle track next to it.
6. **Minimise.** Drop auto waypoints while the route geometry stays identical (Dustin's greedy approach). Smaller URL, fewer handles to drag.
7. **Review UX.**
   - The source track is drawn dashed under the route, and flagged sections are highlighted.
   - The sidebar shows "3 places to check" with next/previous (`N`) and "looks right".
   - Adjust with the existing editor: drag, insert, hold `S` for freehand. Every waypoint the user touches becomes pinned.

Later, if needed: a matching graph restricted to the track corridor (Dustin's 70 m buffer trick), or HMM matching. The TILDA research recommends HMM for noisy GPS. Start with the simple approach and measure.

## 5. Code shape

- `src/shared/track-source/`:
  - `parse-track-file.ts`;
  - `track-store.ts` (IndexedDB, same pattern as `reference-image-store.ts`);
  - `use-restore-track.ts`.
- `src/shared/routing/auto-snap/`:
  - `sample-track.ts`, `match-track.ts`, `section-deviation.ts`, `minimize-waypoints.ts`;
  - plus tests.
- `route-search-codec.ts`: v2 payload `{v: 2, w: [[lon, lat, flags]], l: [sectionLengths]}`, which still decodes v1.
- `route-store.ts`: waypoints become the source of truth; segments are derived from them.
- `workflow-steps.ts`: a `mode` search param (`image` | `track`), with steps per mode. The first screen offers both.
- Export: `buildRouteExportGeoJson` adds `waypoints`, a source reference and, optionally, the track feature. The import path recognises its own exports.
- e2e: a GPX fixture that follows the mocked 5×5 street grid with noise and one off-road shortcut. Overpass stays mocked.

## 6. Phases

1. **Waypoints in the URL** (v2 codec, pinned flag, export with waypoints).
   - Image mode benefits right away: shorter URLs and no lost waypoints.
2. **Track mode, part 1:** the mode choice, upload and parse, the track shown on the map, loading roads along the track.
3. **Track mode, part 2:** auto-snap and the review list.
4. **Re-snap:**
   - change detection on replay;
   - re-match with pinned waypoints;
   - re-importing an exported file.

## 7. Decisions (2026-10-15)

- **Track storage:** IndexedDB plus the export. The URL holds only a key and no track. A shared link replays the waypoints; re-matching from the track needs the browser that holds it, or the exported file.
- **OSM changed since saving:** re-route from the waypoints, then highlight the sections whose length changed so the user can confirm or fix them. Never silently.
- **No road nearby:** that part follows the uploaded track as a freehand stretch, flagged for review.
- **Several tracks or parts in one file:** join them in file order into one route. The gaps between parts become flagged freehand stretches.
- **Modes stay separate:** track mode has no reference image underneath (assumed, not asked).

## 8. As built (2026-10-16)

What differs from the sections above, and why:

- **Road reach is 15 m, not 25 m.** A larger reach pulls the route that far from where the track leaves the road.
- **The road check is made every 10 m along the track.** Without this, a straight stretch through a park simplifies down to its two ends, both on a road, and gets routed around the block.
- **Off-road stretches** become freehand waypoints for every track vertex in the run, thinned out again by 3 m Douglas–Peucker. The snapped points at either end are "anchors" and are never dropped.
- **On re-match, a kept waypoint clears snapped auto points within 150 m** (one sample spacing) along the track, not 40 m. With 40 m, the sample the user had dragged away came straight back.
- **Review items are computed live** from the current route against the track (`findTrackMismatches`, 20 m threshold), plus every freehand stretch. Fixing a place removes it from the list without any bookkeeping. "Looks right" is kept for the session only.
- **Change detection compares section lengths** (more than 5 m and more than 3 % counts as changed). Until the user confirms with "Keep the new route" (or edits the route), the URL keeps the saved version.
- **A saved link whose roads are not loaded** shows a stand-in straight line and a prompt to load the roads along it. The loading buffer is 150 m, because the route can bend away from the straight line between its waypoints. The route tool only takes the route once all waypoints are covered: route-snapper snaps to the nearest node however far away it is.
- **The export** adds a `MultiPoint` (`role: route-tracer:waypoints`, with flags) and optionally a `MultiLineString` (`role: route-tracer:source-track`). Dropping that file into track mode opens the route as it was, with no matching.
- **The step model.** The URL keeps `step` and gains `mode` (`image` | `track`); the steps are `image | track | tracing | export`, and `tracing` is labelled "Adjust" in track mode.

Known limits:

- **The re-snap clearance is a heuristic.** A user point placed far from the track can still produce detours, but the review list flags them.
- **Change detection only covers the sections of the same waypoints.** A link opened straight on the export step is rebuilt without the comparison.
- **"Looks right" decisions and the review cursor are not stored.**
- **Links without section lengths are routed again without a check.** This covers old v1 links and links saved before the route had two points. When the roads were only partly loaded, the URL is rewritten without a notice.
- **Roads count as loaded once every waypoint is covered.** A route that leaves the 150 m band around its waypoints can still run over roads that are missing and take a different path.
