/**
 * Carrier integrations merchants can explicitly enable for live checkout
 * quotes. Values are persisted in `merchant_feature_settings.shipping_providers`.
 */
export const CARRIER_PROVIDER_IDS = ['gigl', 'topship'] as const;

export type CarrierProviderId = (typeof CARRIER_PROVIDER_IDS)[number];
