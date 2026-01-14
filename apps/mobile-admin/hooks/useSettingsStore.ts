import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';

interface SettingsState {
    showDashboardInsight: boolean;
    insightDismissedDate: string | null;
    setInsightDismissed: (dismissed: boolean) => void;
    shouldShowInsight: () => boolean;
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
                const { showDashboardInsight, insightDismissedDate } = get();
                const today = new Date().toDateString();
                return showDashboardInsight && insightDismissedDate !== today;
            },
        }),
        {
            name: 'baci-settings-storage',
            storage: createJSONStorage(() => zustandStorage),
        }
    )
);
