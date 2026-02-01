import { palette } from '@/constants/Colors';

/**
 * Seasonal Utility (2026 Standards)
 * Handles date-based features and provides theme tokens for seasonal effects.
 */

export const SEASONAL = {
  /**
   * Check if a seasonal theme should be active.
   * In 2026, this ideally comes from an API/Feature Flag,
   * but we fall back to the JS Date for local resilience.
   */
  isDecember: () => {
    return new Date().getMonth() === 11;
  },

  /**
   * Safe check for "Santa" feature activation.
   * Combines merchant theme preference with seasonal constraints.
   */
  shouldShowSanta: (theme: string) => {
    return theme === 'santa' && SEASONAL.isDecember();
  },

  /**
   * Seasonal Theme Tokens
   * Prevents hardcoding colors in components.
   */
  getTokens: (theme: string) => {
    const isSanta = SEASONAL.shouldShowSanta(theme);

    return {
      snowColor: palette.white,
      holidayBg: isSanta ? palette.gray[950] : 'transparent',
      holidayAccent: palette.red[600],
      isSanta,
    };
  },
};
