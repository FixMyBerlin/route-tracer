import { GeocodingControl, type BBox, type Feature } from '@maptiler/geocoding-control/maplibregl'
import { useControl } from 'react-map-gl/maplibre'
import { MAPTILER_GEOCODING_API_KEY } from '@/shared/map/maptiler-geocoding-api-key'

// React StrictMode can leave duplicate geocoder DOM until upstream fixes onRemove cleanup:
// https://github.com/maptiler/maptiler-geocoding-control/issues/115
// Patched via patches/@maptiler%2Fgeocoding-control@3.0.0.patch (FixMyBerlin/tilda-geo@2140279).

/** OSM Germany envelope `[west, south, east, north]`. */
const germanyBbox: BBox = [5.8663, 47.2701, 15.0419, 55.0992]

// MapTiler `types` are admin indexes, not OSM place=city. Cities live in `place`;
// kreisfreie Städte (Leipzig) are often `county`; Berlin/Hamburg/Bremen are `region`.
// https://docs.maptiler.com/guides/location-services/geocoding-search/parameters/
const germanCityAndVillageTypes = ['place', 'municipality', 'locality', 'county', 'region'] as const

const settlementPlaceTypes = new Set(['place', 'municipality', 'locality', 'county'])
const inhabitedPlaceDesignations = new Set(['city', 'town', 'village', 'hamlet'])

function isCityOrVillageResult(feature: Feature) {
  if (feature.place_type.some((type) => settlementPlaceTypes.has(type))) return true
  const designation = feature.properties?.place_designation
  return typeof designation === 'string' && inhabitedPlaceDesignations.has(designation)
}

function createGeocodingControl() {
  return new GeocodingControl({
    apiKey: MAPTILER_GEOCODING_API_KEY,
    bbox: germanyBbox,
    country: 'de',
    language: 'de',
    types: [...germanCityAndVillageTypes],
    filter: isCityOrVillageResult,
    proximity: [{ type: 'map-center' }],
    enableReverse: 'never',
    placeholder: 'Stadt oder Dorf suchen…',
    limit: 5,
  })
}

/** MapTiler place search limited to German cities and villages. */
export function MapGeocodingControl() {
  useControl(createGeocodingControl, { position: 'top-left' })
  return null
}
