# Berlin, Kottbusser Tor: real OpenStreetMap test data

Real roads and real GPS traces for one small area, so snapping can be tested on real data offline.

**Never download these again in a test, benchmark, or script.** Both files were fetched once on 2026-10-16. Every run reads them from here. See the "local test data only" rule in the project memory.

| File               | What                                                                                               | Source                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `highways.osm.xml` | Road network: 1,524 ways and 4,637 nodes; the app's own highway query (`buildHighwaysOverpassUrl`) | Overpass API, OSM base 2026-10-16T04:05:43Z                                |
| `trackpoints.gpx`  | 5,000 public, anonymised GPS trackpoints in 64 segments (the first page of results)                | OSM API `GET /api/0.6/trackpoints?bbox=13.410,52.497,13.425,52.507&page=0` |

Area: bbox `52.497,13.410,52.507,13.425` (south, west, north, east), about 1.1 × 1.0 km around Kottbusser Tor and Oranienstraße.

- **Roads:** cycle tracks next to roads, park paths, complex junctions.
- **Traces:** come with noise at junctions.

## Licence

- `highways.osm.xml`: © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/).
- `trackpoints.gpx`: public GPS traces uploaded to openstreetmap.org, used under the [OSM contributor terms](https://osmfoundation.org/wiki/Licence/Contributor_Terms). The OSM API returns them anonymised and without timestamps.
