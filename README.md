# Route Tracer

Browser app to **trace an existing route** from a temporary reference image into proper map geometry: mostly OSM-snapped segments, with explicit manual stretches where OSM cannot follow reality (for example a new bridge).

Export is a GeoJSON `FeatureCollection` of segment LineStrings. The reference image stays in the browser only and is never uploaded.

## Status

Greenfield bootstrap. Domain language: [`CONTEXT.md`](./CONTEXT.md). Research notes: [`research/`](./research/).

## License

Copyright (C) FixMyBerlin GmbH.

This project is [licensed under the AGPL-3.0](./LICENSE.md).
