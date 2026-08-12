import { GeocodingControl } from '@maptiler/geocoding-control/maplibregl'
import { useControl } from 'react-map-gl/maplibre'
import { MAPTILER_GEOCODING_API_KEY } from '@/shared/map/maptiler-geocoding-api-key'

// React StrictMode can leave duplicate geocoder DOM until upstream fixes onRemove cleanup:
// https://github.com/maptiler/maptiler-geocoding-control/issues/115
// Patched via patches/@maptiler%2Fgeocoding-control@3.0.0.patch (FixMyBerlin/tilda-geo@2140279).

const germanCityAndVillageTypes = ['municipality', 'locality'] as const

function createGeocodingControl() {
  return new GeocodingControl({
    apiKey: MAPTILER_GEOCODING_API_KEY,
    country: 'de',
    language: 'de',
    types: [...germanCityAndVillageTypes],
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
