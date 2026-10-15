// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { loadTrackText } from '@/shared/track-source/loaded-track'

const gpx = `<?xml version="1.0"?><gpx><trk><name>Ride</name>
<trkseg><trkpt lat="52.5" lon="13.4"/><trkpt lat="52.5" lon="13.401"/></trkseg>
<trkseg><trkpt lat="52.502" lon="13.401"/><trkpt lat="52.502" lon="13.402"/></trkseg>
</trk></gpx>`

describe('loadTrackText', () => {
  it('keeps parts that do not touch apart', () => {
    const track = loadTrackText('id', 'ride.gpx', gpx)
    expect(track.name).toBe('Ride')
    expect(track.parts).toHaveLength(2)
    expect(track.line).toHaveLength(4)
    // Two ~68 m legs; the jump between the parts does not count.
    expect(track.lengthMeters).toBeGreaterThan(130)
    expect(track.lengthMeters).toBeLessThan(140)
  })

  it('names the track after the file when it has no name', () => {
    const geojson = JSON.stringify({
      type: 'LineString',
      coordinates: [
        [13.4, 52.5],
        [13.41, 52.5],
      ],
    })
    expect(loadTrackText('id', 'commute.geojson', geojson).name).toBe('commute')
  })
})
