type SupportedGateway = 'paystack' | 'korapay';

export function extractVerifiedGatewayFeeNgn(
  gateway: SupportedGateway,
  gatewayResponse: unknown
): number {
  if (gateway !== 'paystack') {
    return 0;
  }
  if (!gatewayResponse || typeof gatewayResponse !== 'object') {
    return 0;
  }
  const fees = (gatewayResponse as Record<string, unknown>).fees;
  if (typeof fees !== 'number' || !Number.isFinite(fees)) {
    return 0;
  }
  return fees / 100;
}
