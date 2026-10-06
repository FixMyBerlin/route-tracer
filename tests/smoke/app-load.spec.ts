import { expect, test } from '@playwright/test'

test.describe('app shell', () => {
  test('loads the Route Tracer UI', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/(\?|$)/)
    await expect(page.locator('main').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Align the reference image' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reference image', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Tracing', exact: true }).click()
    await expect(page).toHaveURL(/step=tracing/)
    await expect(page.getByRole('heading', { name: 'Trace the route' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Network' })).toBeVisible()

    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Export the route' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download GeoJSON' })).toBeDisabled()
  })
})
