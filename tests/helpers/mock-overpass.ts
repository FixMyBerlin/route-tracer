import type { Page } from '@playwright/test'

/**
 * Answer Overpass requests with a small made-up street grid, so tests never put load on the
 * community server. Returns a counter of the requests the app made.
 */
export async function mockOverpass(page: Page, center: { lat: number; lng: number }) {
  const requests = { count: 0 }
  await page.route('**/interpreter?data=*', async (route) => {
    requests.count += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/osm3s+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: streetGridXml(center),
    })
  })
  return requests
}

const GRID_SIZE = 5
const GRID_STEP_DEGREES = 0.001

function streetGridXml(center: { lat: number; lng: number }) {
  const nodeId = (row: number, column: number) => 1000 + row * GRID_SIZE + column
  const half = (GRID_SIZE - 1) / 2
  const nodes: string[] = []
  const ways: string[] = []

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const lat = center.lat + (row - half) * GRID_STEP_DEGREES
      const lon = center.lng + (column - half) * GRID_STEP_DEGREES
      nodes.push(`<node id="${nodeId(row, column)}" lat="${lat}" lon="${lon}"/>`)
    }
  }
  for (let index = 0; index < GRID_SIZE; index += 1) {
    const along = Array.from({ length: GRID_SIZE }, (_, step) => step)
    const street = (id: number, refs: number[]) =>
      `<way id="${id}">${refs.map((ref) => `<nd ref="${ref}"/>`).join('')}<tag k="highway" v="residential"/></way>`
    ways.push(
      street(
        2000 + index,
        along.map((column) => nodeId(index, column)),
      ),
    )
    ways.push(
      street(
        3000 + index,
        along.map((row) => nodeId(row, index)),
      ),
    )
  }

  return `<?xml version="1.0" encoding="UTF-8"?><osm version="0.6">${nodes.join('')}${ways.join('')}</osm>`
}
