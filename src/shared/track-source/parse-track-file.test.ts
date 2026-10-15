// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseTrackText, TrackParseError } from '@/shared/track-source/parse-track-file'

describe('parseTrackText GPX', () => {
  it('throws for GPX that is not well-formed XML', () => {
    expect(() => parseTrackText('<gpx><trk><trkseg><trkpt lat="1" lon="2"></trkseg>')).toThrow(
      TrackParseError,
    )
    expect(() => parseTrackText('<gpx><trk><trkseg><trkpt lat="1" lon="2"></trkseg>')).toThrow(
      'The GPX file is not valid XML.',
    )
  })

  it('reads each trkseg as its own part, in lon/lat order', () => {
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="52.5" lon="13.4"></trkpt>
      <trkpt lat="52.6" lon="13.5"></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="52.7" lon="13.6"></trkpt>
      <trkpt lat="52.8" lon="13.7"></trkpt>
    </trkseg>
  </trk>
</gpx>`

    expect(parseTrackText(gpx, 'ride.gpx')).toEqual({
      parts: [
        [
          [13.4, 52.5],
          [13.5, 52.6],
        ],
        [
          [13.6, 52.7],
          [13.7, 52.8],
        ],
      ],
    })
  })

  it('reads a route as one part and takes its name', () => {
    const gpx = `<gpx version="1.1" creator="x">
  <rte>
    <name>Lake loop</name>
    <rtept lat="48.1" lon="11.5"/>
    <rtept lat="48.2" lon="11.6"></rtept>
    <rtept lat="48.3" lon="11.7"/>
  </rte>
</gpx>`

    expect(parseTrackText(gpx)).toEqual({
      name: 'Lake loop',
      parts: [
        [
          [11.5, 48.1],
          [11.6, 48.2],
          [11.7, 48.3],
        ],
      ],
    })
  })

  it('accepts namespace prefixes, single quotes, self-closing points and any attribute order', () => {
    const gpx = `<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1">
  <gpx:trk><gpx:trkseg>
    <gpx:trkpt lat='52.1' lon='13.1'><gpx:time>2024-01-01T00:00:00Z</gpx:time></gpx:trkpt>
    <gpx:trkpt lon="13.2" lat="52.2" />
  </gpx:trkseg></gpx:trk>
</gpx:gpx>`

    expect(parseTrackText(gpx).parts).toEqual([
      [
        [13.1, 52.1],
        [13.2, 52.2],
      ],
    ])
  })

  it('drops elevation and ignores waypoints', () => {
    const gpx = `<gpx>
  <wpt lat="1" lon="2"><name>Stop</name></wpt>
  <trk>
    <name>Hill</name>
    <trkseg>
      <trkpt lat="47.0" lon="9.0"><ele>1200.5</ele></trkpt>
      <trkpt lat="47.1" lon="9.1"><ele>1300</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`

    const track = parseTrackText(gpx)
    expect(track.name).toBe('Hill')
    expect(track.parts).toEqual([
      [
        [9, 47],
        [9.1, 47.1],
      ],
    ])
  })

  it('decodes entities in the name', () => {
    const escaped = `<gpx><trk><name>Morning &amp; &lt;ride&gt; &quot;x&quot; &apos;y&apos;</name>
<trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>`

    expect(parseTrackText(escaped).name).toBe('Morning & <ride> "x" \'y\'')
  })

  it('takes the name of the track, not of a waypoint before it', () => {
    const gpx = `<gpx><wpt lat="1" lon="1"><name>Cafe</name></wpt>
<trk><name>Tour</name><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>`

    expect(parseTrackText(gpx).name).toBe('Tour')
  })

  it('treats each trk with loose trkpt points as one part when there are no segments', () => {
    const gpx = `<gpx>
  <trk><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trk>
  <trk><trkpt lat="3" lon="3"/><trkpt lat="4" lon="4"/><trkpt lat="5" lon="5"/></trk>
</gpx>`

    expect(parseTrackText(gpx).parts).toEqual([
      [
        [1, 1],
        [2, 2],
      ],
      [
        [3, 3],
        [4, 4],
        [5, 5],
      ],
    ])
  })

  it('throws when the GPX has no track or route points', () => {
    expect(() => parseTrackText('<gpx><wpt lat="1" lon="2"/></gpx>')).toThrow(TrackParseError)
    expect(() => parseTrackText('<gpx><wpt lat="1" lon="2"/></gpx>')).toThrow(/no track or route/)
  })

  it('throws when every GPX point is unusable', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="abc" lon="2"/><trkpt lat="" lon="3"/></trkseg></trk></gpx>`
    expect(() => parseTrackText(gpx)).toThrow(TrackParseError)
  })
})

describe('parseTrackText GeoJSON', () => {
  it('reads line features from a FeatureCollection and skips other geometry', () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Mixed file' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [13, 52, 40],
              [13.1, 52.1, 41],
            ],
          },
        },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [13.2, 52.2],
                [13.3, 52.3],
              ],
              [
                [13.4, 52.4],
                [13.5, 52.5],
              ],
            ],
          },
        },
      ],
    })

    expect(parseTrackText(geojson, 'mixed.geojson')).toEqual({
      name: 'Mixed file',
      parts: [
        [
          [13, 52],
          [13.1, 52.1],
        ],
        [
          [13.2, 52.2],
          [13.3, 52.3],
        ],
        [
          [13.4, 52.4],
          [13.5, 52.5],
        ],
      ],
    })
  })

  it('accepts a bare MultiLineString and a GeometryCollection', () => {
    const multi = JSON.stringify({
      type: 'MultiLineString',
      coordinates: [
        [
          [1, 1],
          [2, 2],
        ],
      ],
    })
    const collection = JSON.stringify({
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [0, 0] },
        {
          type: 'LineString',
          coordinates: [
            [3, 3],
            [4, 4],
          ],
        },
      ],
    })

    expect(parseTrackText(multi).parts).toEqual([
      [
        [1, 1],
        [2, 2],
      ],
    ])
    expect(parseTrackText(collection).parts).toEqual([
      [
        [3, 3],
        [4, 4],
      ],
    ])
  })

  it('reads a bare LineString', () => {
    const line = JSON.stringify({
      type: 'LineString',
      coordinates: [
        [5, 5],
        [6, 6],
      ],
    })
    expect(parseTrackText(line).parts).toEqual([
      [
        [5, 5],
        [6, 6],
      ],
    ])
  })

  it('throws for invalid JSON', () => {
    expect(() => parseTrackText('{"type": "LineString", ')).toThrow(TrackParseError)
  })

  it('throws for GeoJSON without line geometry', () => {
    const point = JSON.stringify({ type: 'Point', coordinates: [1, 2] })
    expect(() => parseTrackText(point)).toThrow(/no line geometry/)
    expect(() => parseTrackText(point)).toThrow(TrackParseError)
  })

  it('throws for an unknown format', () => {
    expect(() => parseTrackText('lat,lon\n1,2\n3,4')).toThrow(TrackParseError)
    expect(() => parseTrackText('   ')).toThrow(TrackParseError)
  })
})

describe('parseTrackText cleaning', () => {
  it('drops repeated consecutive points and out-of-range or non-finite coordinates', () => {
    const line = JSON.stringify({
      type: 'LineString',
      coordinates: [
        [13, 52],
        [13, 52],
        [13.0000000001, 52],
        [13.1, 52],
        [200, 52],
        [13.2, 'x'],
        [13.2, 52],
        [13.2, 52],
      ],
    })

    expect(parseTrackText(line).parts).toEqual([
      [
        [13, 52],
        [13.1, 52],
        [13.2, 52],
      ],
    ])
  })

  it('drops parts with fewer than two points', () => {
    const geojson = JSON.stringify({
      type: 'MultiLineString',
      coordinates: [
        [[1, 1]],
        [
          [2, 2],
          [2, 2],
        ],
        [
          [3, 3],
          [4, 4],
        ],
      ],
    })

    expect(parseTrackText(geojson).parts).toEqual([
      [
        [3, 3],
        [4, 4],
      ],
    ])
  })

  it('throws when no part has usable points', () => {
    const geojson = JSON.stringify({
      type: 'LineString',
      coordinates: [
        [999, 999],
        [1000, 1000],
      ],
    })
    expect(() => parseTrackText(geojson)).toThrow(TrackParseError)
  })
})
