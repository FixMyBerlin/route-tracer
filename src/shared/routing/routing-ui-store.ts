import { create } from 'zustand'

type RoutingUiState = {
  showCoverageDebug: boolean
  actions: {
    setShowCoverageDebug: (enabled: boolean) => void
  }
}

const useRoutingUiStore = create<RoutingUiState>((set) => ({
  showCoverageDebug: false,
  actions: {
    setShowCoverageDebug: (enabled) => set({ showCoverageDebug: enabled }),
  },
}))

export function useShowCoverageDebug() {
  return useRoutingUiStore((state) => state.showCoverageDebug)
}

export function useRoutingUiActions() {
  return useRoutingUiStore((state) => state.actions)
}
