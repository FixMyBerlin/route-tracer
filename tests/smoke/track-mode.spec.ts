import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import lzString from 'lz-string'
import { mockOverpass } from '../helpers/mock-overpass'

const center = { lat: 52.5, lng: 13.4 }

/**
 * Rides the mocked 5×5 street grid (streets every 0.001° around the centre): east along the
 * southern street, north up the eastern one, then cuts diagonally through a block to the west.
 */
function rideGpx() {
  const corners = [
    [13.398, 52.498],
    [13.402, 52.498],
    [13.402, 52.5],
    [13.401, 52.501],
  ]
  const points: string[] = []
  let step = 0
  for (let index = 1; index < corners.length; index += 1) {
    const [lon1, lat1] = corners[index - 1]!
    const [lon2, lat2] = corners[index]!
    for (let i = 0; i < 20; i += 1) {
      const t = i / 20
      const wobble = Math.sin((step += 1)) * 0.00002
      points.push(
        `<trkpt lat="${lat1! + (lat2! - lat1!) * t + wobble}" lon="${lon1! + (lon2! - lon1!) * t}"/>`,
      )
    }
  }
  points.push(`<trkpt lat="52.501" lon="13.401"/>`)
  return `<?xml version="1.0"?><gpx version="1.1"><trk><name>Test ride</name><trkseg>${points.join('')}</trkseg></trk></gpx>`
}

test.describe('track mode', () => {
  test('uploads a track, snaps it, keeps it across a reload and exports it', async ({ page }) => {
    const overpass = await mockOverpass(page, center)
    await page.goto(`/?mode=track&map=16/${center.lat}/${center.lng}`)

    await expect(page.getByRole('heading', { name: 'Snap a GPS track' })).toBeVisible()
    await page.getByTestId('track-file-input').setInputFiles({
      name: 'ride.gpx',
      mimeType: 'application/gpx+xml',
      buffer: Buffer.from(rideGpx()),
    })
    await expect(page.getByText('Test ride')).toBeVisible()

    await page.getByRole('button', { name: 'Load roads along the track' }).click()
    await expect(page.getByText('Roads along the track are loaded.')).toBeVisible()
    expect(overpass.count).toBeGreaterThan(0)
    const requestsAfterLoad = overpass.count

    await page.getByRole('button', { name: 'Snap to roads' }).click()
    await expect(page.getByRole('heading', { name: 'Adjust the route' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Check against your track' })).toBeVisible()
    const points = page.getByText(/^\d+ points$/)
    await expect(points).toBeVisible()
    const pointsText = await points.textContent()
    await expect(page).toHaveURL(/route=/)
    await expect(page).toHaveURL(/trackId=/)

    // Roads come back from the browser cache, the track from IndexedDB: no new requests.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Adjust the route' })).toBeVisible()
    await expect(page.getByText(pointsText ?? '')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Check against your track' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Load the roads under this route' })).toBeHidden()
    expect(overpass.count).toBe(requestsAfterLoad)

    await page.getByRole('button', { name: 'Continue to export' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download GeoJSON' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('test-ride.geojson')
    const exported = JSON.parse(await readFile((await file.path())!, 'utf8')) as {
      features: { properties: { role?: string } }[]
    }
    const roles = exported.features.map((feature) => feature.properties.role)
    expect(roles).toContain('route-tracer:waypoints')
    expect(roles).toContain('route-tracer:source-track')
  })

  test('a shared link loads the roads under its route, then draws it', async ({ page }) => {
    const overpass = await mockOverpass(page, center)
    const route = lzString.compressToEncodedURIComponent(
      JSON.stringify({
        v: 2,
        w: [
          [13.398, 52.498, 3],
          [13.402, 52.498, 3],
          [13.402, 52.501, 3],
        ],
      }),
    )
    await page.goto(`/?step=tracing&route=${route}&map=16/${center.lat}/${center.lng}`)

    const prompt = page.getByRole('region', { name: 'Load the roads under this route' })
    await expect(prompt).toBeVisible()
    expect(overpass.count).toBe(0)
    await prompt.getByRole('button', { name: 'Load roads along the route' }).click()

    await expect(prompt).toBeHidden()
    await expect(page.getByText('3 points')).toBeVisible()
  })
})
