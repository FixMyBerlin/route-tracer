# Route Tracer

Browser app to **trace an existing route** from a temporary reference image into proper map geometry: mostly OSM-snapped segments, with explicit manual stretches where OSM cannot follow reality (for example a new bridge).

Export is a GeoJSON `FeatureCollection` of segment LineStrings. The reference image stays in the browser only and is never uploaded.

## Development

Requires [Bun](https://bun.sh) (≥ 1.3.14).

```bash
bun install
bun run dev
```

Open the URL Vite prints (default `http://127.0.0.1:5173/`). The map viewport syncs to the `?map=zoom/lat/lng` search param.

Other scripts:

- `bun run check` — type-check, lint, format, tests, knip (mutating)
- `bun run build` — production build to `dist/`

Local path deps for map URL helpers and OpenFreeMap Positron style:

- `../../OSM/street-space-editor/packages/osm-map-url`
- `../../OSM/street-space-editor/packages/osm-maplibre`

## Status

Greenfield bootstrap. Domain language: [`CONTEXT.md`](./CONTEXT.md). Research notes: [`research/`](./research/).

## License

Copyright (C) FixMyBerlin GmbH.

This project is [licensed under the AGPL-3.0](./LICENSE.md).
