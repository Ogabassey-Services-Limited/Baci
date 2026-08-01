import { describe, expect, it } from 'vitest';
import { DEFAULT_VTU_SETTINGS } from './vtu-settings-types';

describe('DEFAULT_VTU_SETTINGS', () => {
  it('starts a merchant with core services available but checkout add-ons opt-in', () => {
    expect(DEFAULT_VTU_SETTINGS).toMatchObject({
      vtu_airtime_enabled: true,
      vtu_checkout_addon_enabled: false,
      vtu_data_enabled: true,
      vtu_enabled: false,
      vtu_loyalty_reward_enabled: false,
    });
    expect(DEFAULT_VTU_SETTINGS.vtu_checkout_addon_amounts).toEqual([
      100, 200, 500, 1000,
    ]);
  });
});
