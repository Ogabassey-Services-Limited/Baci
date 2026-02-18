import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

interface SettingsState {
  showDashboardInsight: boolean;
  insightDismissedDate: string | null;
  setInsightDismissed: (dismissed: boolean) => void;
  shouldShowInsight: () => boolean;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      showDashboardInsight: true,
      insightDismissedDate: null,

      setInsightDismissed: (dismissed: boolean) => {
        const today = new Date().toDateString();
        set({
          showDashboardInsight: !dismissed,
          insightDismissedDate: dismissed ? today : null,
        });
      },

      shouldShowInsight: () => {
        const { insightDismissedDate } = get();
        const today = new Date().toDateString();
        return insightDismissedDate !== today;
      },

      reset: () => {
        set({
          showDashboardInsight: true,
          insightDismissedDate: null,
        });
      },
    }),
    {
      name: 'baci-settings-storage',
      storage: createJSONStorage(() => zustandStorage),
    }
  )
);
