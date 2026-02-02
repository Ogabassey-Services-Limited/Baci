import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SEASONAL } from '@/lib/seasonal';

type ThemeMode = 'standard' | 'santa';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Initialize based on current date
      theme: SEASONAL.isDecember() ? 'santa' : 'standard',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'santa' ? 'standard' : 'santa',
        })),
    }),
    {
      name: 'app-theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: (_state) => {
        return (rehydratedState, error) => {
          if (error || !rehydratedState) return;

          // 2026 Standard: Force reset seasonal theme if out of season
          if (rehydratedState.theme === 'santa' && !SEASONAL.isDecember()) {
            rehydratedState.setTheme('standard');
          }
        };
      },
    }
  )
);
