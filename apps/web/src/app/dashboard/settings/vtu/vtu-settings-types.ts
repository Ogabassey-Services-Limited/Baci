export interface VTUSettings {
  vtu_enabled: boolean;
  vtu_airtime_enabled: boolean;
  vtu_data_enabled: boolean;
  vtu_checkout_addon_enabled: boolean;
  vtu_checkout_addon_amounts: number[];
  vtu_loyalty_reward_enabled: boolean;
  vtu_merchant_commission_rate: number;
}

export const DEFAULT_VTU_SETTINGS: VTUSettings = {
  vtu_enabled: false,
  vtu_airtime_enabled: true,
  vtu_data_enabled: true,
  vtu_checkout_addon_enabled: false,
  vtu_checkout_addon_amounts: [100, 200, 500, 1000],
  vtu_loyalty_reward_enabled: false,
  vtu_merchant_commission_rate: 0.5,
};
