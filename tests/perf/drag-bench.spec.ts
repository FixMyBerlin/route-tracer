import { test, type Page } from '@playwright/test'
import lzString from 'lz-string'
import { mockOverpass } from '../helpers/mock-overpass'

/**
 * Timing of drags and drawing on a long route over a big street grid. Skipped unless
 * PERF_BENCH=1, so the normal suite stays quick. Prints one JSON line per scenario.
 */

const center = { lat: 52.5, lng: 13.4 }
const GRID = 30
const STEP = 0.001
const ZOOM = 15

/** Grid node as [lon, lat], row and column counted from the south-west corner. */
function node(row: number, column: number): [number, number] {
  const half = (GRID - 1) / 2
  return [center.lng + (column - half) * STEP, center.lat + (row - half) * STEP]
}

/** 50 nodes on a serpentine over five street rows, ten nodes each. */
function serpentine(): [number, number][] {
  const points: [number, number][] = []
  const columns = Array.from({ length: 10 }, (_, index) => index * 3)
  for (const [rowIndex, row] of [1, 4, 7, 10, 13].entries()) {
    const ordered = rowIndex % 2 === 0 ? columns : [...columns].reverse()
    for (const column of ordered) points.push(node(row, column))
  }
  return points
}

const INIT = `
window.__pm = { active: false, dispatch: [], longtasks: [] }
window.addEventListener('mousemove', () => { window.__pmT = performance.now() }, true)
window.addEventListener('mousemove', () => {
  if (window.__pm.active && window.__pmT != null) window.__pm.dispatch.push(performance.now() - window.__pmT)
}, false)
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) window.__pm.longtasks.push(entry.duration)
  }).observe({ type: 'longtask', buffered: false })
} catch {}
`

async function startMeasure(page: Page) {
  await page.evaluate(() => {
    window.__pm.active = true
    window.__pm.dispatch = []
    window.__pm.longtasks = []
  })
}

async function stopMeasure(page: Page, moves: number, wallMs: number, label: string) {
  const result = await page.evaluate(() => {
    window.__pm.active = false
    const d = [...window.__pm.dispatch].sort((a, b) => a - b)
    const lt = window.__pm.longtasks
    const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
    return {
      events: d.length,
      handlerMeanMs: d.length ? sum(d) / d.length : 0,
      handlerP95Ms: d.length ? d[Math.floor(d.length * 0.95)] : 0,
      handlerMaxMs: d.length ? d[d.length - 1] : 0,
      longTasks: lt.length,
      longTaskTotalMs: sum(lt),
      longTaskMaxMs: lt.length ? Math.max(...lt) : 0,
    }
  })
  console.log(
    'PERF ' +
      JSON.stringify({
        label,
        moves,
        wallPerMoveMs: +(wallMs / moves).toFixed(2),
        ...result,
        handlerMeanMs: +result.handlerMeanMs.toFixed(2),
        handlerP95Ms: +result.handlerP95Ms.toFixed(2),
        handlerMaxMs: +result.handlerMaxMs.toFixed(2),
        longTaskTotalMs: +result.longTaskTotalMs.toFixed(1),
        longTaskMaxMs: +result.longTaskMaxMs.toFixed(1),
      }),
  )
}

async function pixelOf(page: Page, lng: number, lat: number) {
  const point = await page.evaluate(([x, y]) => window.__mainMap?.project([x!, y!]), [lng, lat])
  const box = await page.locator('main canvas').first().boundingBox()
  if (!point || !box) throw new Error('map not ready')
  return { x: box.x + point.x, y: box.y + point.y }
}

test.describe('drag and draw timing', () => {
  test.skip(!process.env.PERF_BENCH, 'set PERF_BENCH=1 to run the timing bench')
  test.setTimeout(600_000)

  test('dragging one waypoint of a 50-point finished route', async ({ page }) => {
    await page.addInitScript(INIT)
    await mockOverpass(page, center, { gridSize: GRID })
    const points = serpentine()
    const route = lzString.compressToEncodedURIComponent(
      JSON.stringify({ v: 2, w: points.map(([lon, lat]) => [lon, lat, 3]) }),
    )
    await page.goto(`/?step=tracing&route=${route}&map=${ZOOM}/${center.lat}/${center.lng}`)
    await page.getByRole('button', { name: 'Load roads along the route' }).click()
    await page.getByText('50 points').waitFor()
    await page.waitForTimeout(500)

    const index = 25
    const [lon, lat] = points[index]!
    const from = await pixelOf(page, lon, lat)
    const to = await pixelOf(page, lon + 0.0015, lat + 0.0015)

    await page.mouse.move(from.x, from.y)
    await page.waitForTimeout(200)
    await page.mouse.down()
    await startMeasure(page)
    const moves = 60
    const started = Date.now()
    await page.mouse.move(to.x, to.y, { steps: moves })
    const wallMs = Date.now() - started
    await page.mouse.up()
    await stopMeasure(page, moves, wallMs, 'drag-waypoint-50pt')
  })

  test('drawing: rubber band over a 50-point unfinished route', async ({ page }) => {
    await page.addInitScript(INIT)
    await mockOverpass(page, center, { gridSize: GRID })
    await page.goto(`/?step=tracing&map=${ZOOM}/${center.lat}/${center.lng}`)
    await page.getByRole('button', { name: 'Load roads for this area' }).click()
    await page.getByText('ready').waitFor()

    const points = serpentine()
    for (const [index, [lon, lat]] of points.entries()) {
      const count = index + 1
      const at = await pixelOf(page, lon, lat)
      await page.mouse.move(at.x, at.y)
      await page.mouse.click(at.x, at.y)
      await page.getByText(`${count} ${count === 1 ? 'point' : 'points'}`).waitFor({ timeout: 10_000 })
    }
    await page.waitForTimeout(500)

    // Cursor sweeps across the grid with the route still open: every move re-routes the preview.
    const start = await pixelOf(page, center.lng - 0.012, center.lat - 0.012)
    const end = await pixelOf(page, center.lng + 0.012, center.lat + 0.012)
    await page.mouse.move(start.x, start.y)
    await page.waitForTimeout(200)
    await startMeasure(page)
    const moves = 60
    const started = Date.now()
    await page.mouse.move(end.x, end.y, { steps: moves })
    const wallMs = Date.now() - started
    await stopMeasure(page, moves, wallMs, 'draw-rubberband-50pt')
  })
})
