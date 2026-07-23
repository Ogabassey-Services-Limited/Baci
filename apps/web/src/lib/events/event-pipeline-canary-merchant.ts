export function isEventPipelineCanaryMerchant(merchantId?: string): boolean {
  const configured = (
    process.env.EVENT_PIPELINE_CANARY_MERCHANT_IDS ?? ''
  ).trim();
  if (configured === '*') return true;
  if (!merchantId) return false;
  const normalizedMerchantId = merchantId.toLowerCase();
  return configured
    .split(',')
    .some((value) => value.trim().toLowerCase() === normalizedMerchantId);
}
