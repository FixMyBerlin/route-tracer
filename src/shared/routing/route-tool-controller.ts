import type { RouteTool } from 'route-snapper-ts'
import { clearRouteState } from '@/shared/routing/route-store'

let activeRouteTool: RouteTool | null = null

export function setActiveRouteTool(tool: RouteTool | null) {
  activeRouteTool = tool
}

export function toggleDrawThroughMode() {
  activeRouteTool?.toggleSnapMode()
}

export function undoRouteEdit() {
  activeRouteTool?.undo()
}

export function clearActiveRoute() {
  activeRouteTool?.stop()
  clearRouteState()
}
