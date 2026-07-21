export function normalizeMerchantId(merchantId: unknown): string | null {
  return typeof merchantId === 'string' ? merchantId.trim() || null : null;
}
