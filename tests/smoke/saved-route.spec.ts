import { expect, test, type Page } from '@playwright/test'
import lzString from 'lz-string'
import { mockOverpass } from '../helpers/mock-overpass'

const center = { lat: 52.5, lng: 13.4 }

function routeParam(payload: unknown) {
  return lzString.compressToEncodedURIComponent(JSON.stringify(payload))
}

function urlWaypointCount(page: Page) {
  const route = routeInUrl(page)
  if (!route) return 0
  return (
    JSON.parse(lzString.decompressFromEncodedURIComponent(route) ?? '{}') as { w?: unknown[] }
  ).w?.length
}

function routeInUrl(page: Page) {
  return new URL(page.url()).searchParams.get('route')
}

/** Click the map at a coordinate (the dev build exposes the map as `window.__mainMap`). */
async function clickAt(page: Page, lng: number, lat: number) {
  const point = await page.evaluate(([x, y]) => window.__mainMap?.project([x!, y!]), [lng, lat])
  const box = await page.locator('main canvas').first().boundingBox()
  if (!point || !box) throw new Error('map not ready')
  await page.mouse.move(box.x + point.x, box.y + point.y)
  await page.mouse.click(box.x + point.x, box.y + point.y)
}

test.describe('saved routes', () => {
  test('keeps every clicked point across a reload', async ({ page }) => {
    await mockOverpass(page, center)
    await page.goto(`/?step=tracing&map=17/${center.lat}/${center.lng}`)
    await page.getByRole('button', { name: 'Load roads for this area' }).click()
    await expect(page.getByText('ready')).toBeVisible()

    // Three snapped clicks along one street: they used to merge into one stretch on reload.
    const clicks: [number, number][] = [
      [13.399, 52.5],
      [13.4, 52.5],
      [13.401, 52.5],
    ]
    for (const [index, [lng, lat]] of clicks.entries()) {
      const count = index + 1
      // Retry: under load the route tool can still be starting when the first click lands.
      await expect(async () => {
        await clickAt(page, lng, lat)
        await expect(page.getByText(`${count} ${count === 1 ? 'point' : 'points'}`)).toBeVisible({
          timeout: 1000,
        })
      }).toPass()
    }
    // The URL is written 300 ms after the last edit.
    await expect.poll(() => urlWaypointCount(page)).toBe(3)

    await page.reload()
    await expect(page.getByText('3 points')).toBeVisible()
  })

  test('shows what changed since the link was saved before saving over it', async ({ page }) => {
    await mockOverpass(page, center)
    // Saved with a first stretch of 300 m; on the mocked roads it is ~68 m.
    const route = routeParam({
      v: 2,
      w: [
        [13.398, 52.5, 3],
        [13.399, 52.5, 3],
        [13.399, 52.501, 3],
      ],
      l: [300, 111],
    })
    await page.goto(`/?step=tracing&route=${route}&map=16/${center.lat}/${center.lng}`)
    await page.getByRole('button', { name: 'Load roads along the route' }).click()

    const notice = page.getByRole('status').filter({ hasText: 'changed since this link was saved' })
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('Was 300 m, now 68 m')
    // The link keeps the saved lengths until the user decides.
    expect(routeInUrl(page)).toBe(route)

    await notice.getByRole('button', { name: 'Keep the new route' }).click()
    await expect(notice).toBeHidden()
    await expect.poll(() => routeInUrl(page)).not.toBe(route)
  })
})
