import { expect, test } from '@playwright/test'

test.describe('app shell', () => {
  test('loads the Route Tracer UI', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/(\?|$)/)
    await expect(page.locator('main').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Trace a route' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reference image' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Routing' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Route segments' })).toBeVisible()
  })
})
