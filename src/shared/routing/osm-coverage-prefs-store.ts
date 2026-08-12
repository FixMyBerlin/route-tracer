import { create } from 'zustand'

type OsmCoveragePrefsStore = {
  /** When true, skip durable restore/save until turned off. */
  preferFresh: boolean
  actions: {
    setPreferFresh: (preferFresh: boolean) => void
  }
}

const useOsmCoveragePrefsStore = create<OsmCoveragePrefsStore>()((set) => ({
  preferFresh: false,
  actions: {
    setPreferFresh: (preferFresh) =>
      set((state) => (state.preferFresh === preferFresh ? state : { preferFresh })),
  },
}))

export function useOsmPreferFresh() {
  return useOsmCoveragePrefsStore((state) => state.preferFresh)
}

export function getOsmPreferFresh() {
  return useOsmCoveragePrefsStore.getState().preferFresh
}

export function useOsmCoveragePrefsActions() {
  return useOsmCoveragePrefsStore((state) => state.actions)
}
