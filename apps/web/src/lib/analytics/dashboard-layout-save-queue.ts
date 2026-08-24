import type { DashboardLayoutConfig } from '@/components/analytics/analytics-grid-layout-hydration';

export type DashboardLayoutSave = (
  layout: DashboardLayoutConfig,
  merchantId?: string,
  signal?: AbortSignal
) => Promise<void>;

export interface DashboardLayoutSaveQueue {
  enqueue(layout: DashboardLayoutConfig, merchantId?: string): Promise<void>;
  reset(): void;
}

/**
 * Serializes layout writes and invalidates queued work when the selected
 * merchant or category changes. The API upsert is last-write-wins, so allowing
 * concurrent requests would let an older drag overwrite the latest layout.
 */
export function createDashboardLayoutSaveQueue(
  save: DashboardLayoutSave
): DashboardLayoutSaveQueue {
  let tail: Promise<void> = Promise.resolve();
  let generation = 0;
  let controller = new AbortController();

  return {
    enqueue(layout, merchantId) {
      const requestGeneration = generation;
      const requestController = controller;
      const task = tail
        .catch(() => undefined)
        .then(() => {
          if (
            requestGeneration !== generation ||
            requestController.signal.aborted
          ) {
            return;
          }
          return save(layout, merchantId, requestController.signal);
        });
      tail = task.catch(() => undefined);
      return task;
    },
    reset() {
      generation += 1;
      controller.abort();
      controller = new AbortController();
    },
  };
}
