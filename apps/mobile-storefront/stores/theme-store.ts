import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SEASONAL } from '@/lib/seasonal';
import { asyncStorage as AsyncStorage } from '@/lib/storage';

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
      // M26 fix: Handle edge cases in rehydration callback.
      // The callback fires after AsyncStorage has loaded and state has been merged.
      // Use queueMicrotask to ensure the store is fully ready before reading/writing.
      onRehydrateStorage: () => {
        return (rehydratedState, error) => {
          if (error) {
            // Rehydration failed — fall back to the default (season-based) theme.
            // The initial state already handles this, so no action needed.
            return;
          }
          if (!rehydratedState) return;

          // 2026 Standard: Force reset seasonal theme if out of season.
          // Defer setState to avoid writing during the rehydration cycle.
          if (rehydratedState.theme === 'santa' && !SEASONAL.isDecember()) {
            queueMicrotask(() => {
              useThemeStore.setState({ theme: 'standard' });
            });
          }
        };
      },
    }
  )
);
