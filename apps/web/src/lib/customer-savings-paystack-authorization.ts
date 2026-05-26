import type { PaystackAuthorization } from '@/lib/customer-saved-payment-methods';

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isNullableString(value: unknown) {
  return value == null || typeof value === 'string';
}

export function getSavingsPaystackAuthorization(
  gatewayResponse: Record<string, unknown>
): PaystackAuthorization | null {
  const authorization = gatewayResponse.authorization;
  if (!authorization || typeof authorization !== 'object') {
    return null;
  }

  const record = authorization as Record<string, unknown>;
  const authorizationCode = getString(record.authorization_code);
  const signature = getString(record.signature);
  if (
    !authorizationCode ||
    !signature ||
    record.reusable !== true ||
    !isNullableString(record.card_type) ||
    !isNullableString(record.last4) ||
    !isNullableString(record.exp_month) ||
    !isNullableString(record.exp_year) ||
    !isNullableString(record.bank) ||
    !isNullableString(record.channel) ||
    !isNullableString(record.country_code)
  ) {
    return null;
  }

  return {
    account_name: isNullableString(record.account_name)
      ? (record.account_name ?? null)
      : null,
    authorization_code: authorizationCode,
    bank: record.bank ?? null,
    bin: isNullableString(record.bin) ? (record.bin ?? null) : null,
    brand: isNullableString(record.brand) ? (record.brand ?? null) : null,
    card_type: record.card_type ?? null,
    channel: record.channel ?? null,
    country_code: record.country_code ?? null,
    exp_month: record.exp_month ?? null,
    exp_year: record.exp_year ?? null,
    last4: record.last4 ?? null,
    reusable: true,
    signature,
  };
}
