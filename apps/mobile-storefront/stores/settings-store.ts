import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
