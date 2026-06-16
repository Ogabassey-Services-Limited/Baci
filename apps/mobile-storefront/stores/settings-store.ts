import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorage as AsyncStorage } from '@/lib/storage';

export type AppearanceMode = 'system' | 'light' | 'dark';

export interface SettingsState {
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: 'system',
      setAppearance: (appearance) => set({ appearance }),
    }),
    {
      name: 'app-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
