import type { WalletTopUpGateway } from '@/schemas/wallet-top-up';

export interface WalletTopUpGatewaySettings {
  korapay_enabled: boolean | null;
  paystack_enabled: boolean | null;
  preferred_local_gateway: string | null;
}

/** Thrown for client-correctable gateway-selection failures (mapped to 400). */
export class WalletTopUpClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletTopUpClientError';
    Object.setPrototypeOf(this, WalletTopUpClientError.prototype);
  }
}

function isWalletTopUpGateway(value: unknown): value is WalletTopUpGateway {
  return value === 'paystack' || value === 'korapay';
}

/**
 * Choose the wallet top-up gateway for a merchant. Paystack defaults ON; Korapay
 * is opt-in (default OFF) — a missing/null `korapay_enabled` must not enable a
 * Korapay top-up, matching the storefront checkout gate and the
 * merchant_feature_settings default.
 */
export function selectWalletTopUpGateway({
  requestedGateway,
  settings,
}: {
  requestedGateway?: WalletTopUpGateway;
  settings: WalletTopUpGatewaySettings;
}): WalletTopUpGateway {
  const paystackEnabled = settings.paystack_enabled ?? true;
  const korapayEnabled = settings.korapay_enabled ?? false;

  if (requestedGateway) {
    if (requestedGateway === 'paystack' && paystackEnabled) return 'paystack';
    if (requestedGateway === 'korapay' && korapayEnabled) return 'korapay';
    throw new WalletTopUpClientError(
      `${requestedGateway} is not enabled for wallet top-ups`
    );
  }

  if (
    isWalletTopUpGateway(settings.preferred_local_gateway) &&
    ((settings.preferred_local_gateway === 'paystack' && paystackEnabled) ||
      (settings.preferred_local_gateway === 'korapay' && korapayEnabled))
  ) {
    return settings.preferred_local_gateway;
  }

  if (paystackEnabled) return 'paystack';
  if (korapayEnabled) return 'korapay';

  throw new WalletTopUpClientError(
    'No wallet top-up gateway is enabled for this merchant'
  );
}
