import type {
  CalculateOrderInputType,
  CalculateOrderOutputType,
} from './validation';

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateOrderTotals(
  input: CalculateOrderInputType
): CalculateOrderOutputType {
  const subtotal = Number.isFinite(input.subtotal) ? input.subtotal : 0;
  const shippingFee = Number.isFinite(input.shippingFee ?? 0)
    ? (input.shippingFee ?? 0)
    : 0;
  const taxRate = Number.isFinite(input.taxRate ?? 0)
    ? (input.taxRate ?? 0)
    : 0;
  const assuranceFee = Number.isFinite(input.assuranceFee ?? 0)
    ? (input.assuranceFee ?? 0)
    : 0;

  const taxAmount = roundCurrency(subtotal * taxRate);
  const total = roundCurrency(
    subtotal + shippingFee + assuranceFee + taxAmount
  );

  return {
    taxAmount,
    total,
  };
}

export function normalizeRemoteOrderTotals(
  input: CalculateOrderInputType,
  remote: Partial<CalculateOrderOutputType> | null | undefined
): CalculateOrderOutputType {
  const local = calculateOrderTotals(input);
  const remoteTaxAmount =
    typeof remote?.taxAmount === 'number' && Number.isFinite(remote.taxAmount)
      ? roundCurrency(remote.taxAmount)
      : local.taxAmount;
  const remoteTotal = roundCurrency(
    local.total - local.taxAmount + remoteTaxAmount
  );

  return {
    taxAmount: remoteTaxAmount,
    total: Number.isFinite(remoteTotal) ? remoteTotal : local.total,
  };
}

// Safe only for `calculate_order`; VTU and loyalty non-2xx responses are
// meaningful business errors and must not be converted to local totals.
export function canFallbackToLocalOrderTotals(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  const code =
    'code' in error && typeof error.code === 'string'
      ? error.code.toLowerCase()
      : '';

  return (
    code === 'network_error' ||
    code === 'timeout_error' ||
    name.includes('functionsfetcherror') ||
    message.includes('failed to send a request to the edge function') ||
    message.includes('edge function returned a non-2xx status code') ||
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('timed out')
  );
}
