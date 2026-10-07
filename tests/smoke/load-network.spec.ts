import { expect, test } from '@playwright/test'
import { mockOverpass } from '../helpers/mock-overpass'

const center = { lat: 52.5, lng: 13.4 }

test.describe('loading the road network', () => {
  test('asks in the middle of the map and loads once', async ({ page }) => {
    const overpass = await mockOverpass(page, center)
    await page.goto(`/?step=tracing&map=16/${center.lat}/${center.lng}`)

    const prompt = page.getByRole('region', { name: 'No roads loaded here yet' })
    await expect(prompt).toBeVisible()
    await expect(prompt).toContainText('community-run server')
    expect(overpass.count).toBe(0)

    await prompt.getByRole('button', { name: 'Load roads for this area' }).click()

    await expect(prompt).toBeHidden()
    await expect(page.getByText('Roads for this view are loaded.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload roads for this view' })).toBeVisible()
    await expect(page.getByText('ready')).toBeVisible()
    expect(overpass.count).toBe(1)
  })

  test('asks to zoom in instead while zoomed out', async ({ page }) => {
    const overpass = await mockOverpass(page, center)
    await page.goto(`/?step=tracing&map=12/${center.lat}/${center.lng}`)

    await expect(page.getByText('Zoom in to load roads')).toBeVisible()
    await expect(page.getByRole('region', { name: 'No roads loaded here yet' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Load roads for this view' })).toBeDisabled()
    expect(overpass.count).toBe(0)
  })
})
