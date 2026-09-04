export const prepaidGiglCustomerCheckoutOrderFields = {
  shipping_funding_source: 'customer_checkout' as const,
  payment_status: 'paid',
  payment_method: 'card',
};

/** Complete GIGL economics so booking does not force-refresh live quotes. */
export const giglQuoteEconomicsFields = {
  provider_cost: 3600,
  platform_margin: 900,
  platform_margin_bps: 2000,
  pricing_version: 'gigl_platform_margin_v1',
};
