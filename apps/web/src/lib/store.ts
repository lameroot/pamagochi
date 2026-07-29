import { create } from 'zustand';

interface AppState {
  activeChildName: string | null;
  sceneReady: boolean;
  setActiveChildName: (name: string | null) => void;
  setSceneReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeChildName: null,
  sceneReady: false,
  setActiveChildName: (name) => set({ activeChildName: name }),
  setSceneReady: (ready) => set({ sceneReady: ready }),
}));
