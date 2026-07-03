import { create } from 'zustand';

type AppState = {
  night: boolean;
  selectedLandmark: string | null;
  toggleNight: () => void;
  setSelectedLandmark: (id: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  night: false,
  selectedLandmark: null,
  toggleNight: () => set((s) => ({ night: !s.night })),
  setSelectedLandmark: (id) => set({ selectedLandmark: id }),
}));
