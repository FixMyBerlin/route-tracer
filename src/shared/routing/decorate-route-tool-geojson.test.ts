import { emptyParsedOsmData } from '@osm-editor-kit/osm-data'
import type { FeatureCollection, LineString, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import { decorateRouteToolGeoJson } from '@/shared/routing/decorate-route-tool-geojson'
import { densifyParsedOsmForSnapping } from '@/shared/routing/densify-osm-for-snapping'

describe('decorateRouteToolGeoJson', () => {
  it('marks original OSM nodes as edge and densified/free points as mid', () => {
    const data = emptyParsedOsmData()
    data.nodeCoords[1] = [52, 13]
    densifyParsedOsmForSnapping(data)

    const geojson: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13, 52] },
          properties: { type: 'snapped-waypoint' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13.001, 52.001] },
          properties: { type: 'snapped-waypoint' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13.002, 52.002] },
          properties: { type: 'free-waypoint' },
        },
      ],
    }

    const decorated = decorateRouteToolGeoJson(geojson, null, null)
    expect(decorated.features[0]?.properties?.kind).toBe('edge')
    expect(decorated.features[1]?.properties?.kind).toBe('mid')
    expect(decorated.features[2]?.properties?.kind).toBe('mid')
    expect(decorated.features[0]?.properties?.click_index).toBe(1)
    expect(decorated.features[1]?.properties?.click_index).toBe(2)
    expect(decorated.features[2]?.properties?.click_index).toBe(3)
  })

  it('numbers waypoints along the confirmed route, not the rubber-band hover', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [13, 52],
              [13.001, 52],
            ],
          },
          properties: { snapped: true },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [13.001, 52],
              [13.002, 52],
            ],
          },
          properties: { snapped: true },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13.002, 52] },
          properties: { type: 'snapped-waypoint' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13, 52] },
          properties: { type: 'snapped-waypoint' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13.001, 52] },
          properties: { type: 'snapped-waypoint' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13.003, 52] },
          properties: { type: 'snapped-waypoint', hovered: true },
        },
      ],
    }

    const decorated = decorateRouteToolGeoJson(geojson, null, null)
    const indexAt = (lon: number, lat: number) =>
      decorated.features.find(
        (feature) =>
          feature.geometry.type === 'Point' &&
          feature.geometry.coordinates[0] === lon &&
          feature.geometry.coordinates[1] === lat,
      )?.properties?.click_index

    expect(indexAt(13, 52)).toBe(1)
    expect(indexAt(13.001, 52)).toBe(2)
    expect(indexAt(13.002, 52)).toBe(3)
    expect(indexAt(13.003, 52)).toBeUndefined()
  })

  it('adds a mid-edge preview on the nearest road within 5 m', () => {
    const network: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [13, 52],
              [13.001, 52],
            ],
          },
        },
      ],
    }
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    const decorated = decorateRouteToolGeoJson(empty, [13.0005, 52.00001], network)
    const preview = decorated.features.find(
      (feature) => feature.properties?.type === 'snap-preview',
    )
    expect(preview?.properties?.kind).toBe('mid')
    expect(preview?.geometry.type).toBe('Point')
    expect(preview?.properties?.click_index).toBeUndefined()
  })
})
