import type { AdPlatformTarget } from './ad-platform-target';

export type AdPlatformResults = Partial<
  Record<
    AdPlatformTarget,
    { success: boolean; error?: string; httpStatus?: number }
  >
>;
