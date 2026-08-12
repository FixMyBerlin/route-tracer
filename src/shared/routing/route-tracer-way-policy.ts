import { tag, type OsmWaySelectionPolicy } from '@osm-editor-kit/osm-way-chain'

/**
 * Route-tracer Overpass / graph way policy.
 *
 * Includes bike-routable highway classes, bike + foot infra, and steps.
 * Excludes private/no access. Sidewalks only when explicitly bike-allowed.
 */
export const routeTracerWayPolicy: OsmWaySelectionPolicy = {
  include: [
    // Bike-related + shared / bike-routable highway classes
    {
      all: [
        tag.oneOf('highway', [
          'cycleway',
          'path',
          'track',
          'bridleway',
          'pedestrian',
          'living_street',
          'residential',
          'unclassified',
          'tertiary',
          'secondary',
          'primary',
          'service',
        ]),
      ],
    },
    // Footways that are not sidewalks
    {
      all: [tag.eq('highway', 'footway'), tag.neq('footway', 'sidewalk')],
    },
    // Sidewalks only when bikes are allowed
    {
      all: [
        tag.eq('highway', 'footway'),
        tag.eq('footway', 'sidewalk'),
        tag.oneOf('bicycle', ['yes', 'designated']),
      ],
    },
    // Steps / stairs
    { all: [tag.eq('highway', 'steps')] },
    // Bike infra tagged on otherwise non-matching ways
    { all: [tag.oneOf('bicycle', ['yes', 'designated'])] },
    { all: [tag.present('cycleway')] },
  ],
  globalAll: [tag.neq('access', 'private'), tag.neq('access', 'no')],
}
