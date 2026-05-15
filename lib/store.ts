// Atlas UI state. Spec section 4.2: only file that imports zustand.
// Holds the selected node id and the active filter chip. Selectors derive
// the actual selected node from the data passed to <ConstellationCanvas />.

import { create } from 'zustand'

export type FilterKind = 'all' | 'project' | 'skill' | 'agent' | 'reference'

interface AtlasStore {
  selectedId: string | null
  activeFilter: FilterKind
  setSelected: (id: string | null) => void
  setFilter: (filter: FilterKind) => void
}

export const useAtlasStore = create<AtlasStore>((set) => ({
  selectedId: null,
  activeFilter: 'project',
  setSelected: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ activeFilter: filter }),
}))
