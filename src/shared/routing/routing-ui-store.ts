import { create } from 'zustand'

export type NetworkHighlightMode = 'invisible' | 'overpass' | 'routing'

type RoutingUiState = {
  showCoverageDebug: boolean
  networkHighlight: NetworkHighlightMode
  actions: {
    setShowCoverageDebug: (enabled: boolean) => void
    setNetworkHighlight: (mode: NetworkHighlightMode) => void
  }
}

const useRoutingUiStore = create<RoutingUiState>()((set) => ({
  showCoverageDebug: false,
  networkHighlight: 'invisible',
  actions: {
    setShowCoverageDebug: (enabled) => set({ showCoverageDebug: enabled }),
    setNetworkHighlight: (mode) => set({ networkHighlight: mode }),
  },
}))

export function useShowCoverageDebug() {
  return useRoutingUiStore((state) => state.showCoverageDebug)
}

export function useNetworkHighlight() {
  return useRoutingUiStore((state) => state.networkHighlight)
}

export function useRoutingUiActions() {
  return useRoutingUiStore((state) => state.actions)
}

/** Similar sky/teal pair for Overpass vs routing-network highlights. */
export const NETWORK_HIGHLIGHT_COLORS = {
  overpass: '#38bdf8',
  routing: '#2dd4bf',
} as const
