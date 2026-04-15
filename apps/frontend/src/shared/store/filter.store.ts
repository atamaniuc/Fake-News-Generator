import { create } from 'zustand';

type FilterStore = {
  selectedSource: string | null;
  setSource: (source: string | null) => void;
};

export const useFilterStore = create<FilterStore>((set) => ({
  selectedSource: null,
  setSource: (source) => set({ selectedSource: source }),
}));
