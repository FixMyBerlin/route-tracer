import type { RouteSectionChange } from '@/shared/routing/route-store'

/** Small differences come from rounding and graph densifying, not from a different way. */
const MIN_CHANGE_METERS = 5
const MIN_CHANGE_RATIO = 0.03

/**
 * Sections whose length moved noticeably since the route was saved. Compared by index, so it
 * only applies to the same waypoints routed again.
 */
export function diffSectionLengths(before: number[], after: number[]): RouteSectionChange[] {
  if (before.length !== after.length) return []
  const changes: RouteSectionChange[] = []
  for (const [sectionIndex, beforeMeters] of before.entries()) {
    const afterMeters = after[sectionIndex] ?? beforeMeters
    const delta = Math.abs(afterMeters - beforeMeters)
    if (delta > MIN_CHANGE_METERS && delta > MIN_CHANGE_RATIO * beforeMeters) {
      changes.push({ sectionIndex, beforeMeters, afterMeters })
    }
  }
  return changes
}
