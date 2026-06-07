import type {
  SavingsSelection,
  WalletSelection,
} from '@/lib/wallet-payment-helpers';

export interface KlumpPaymentSettings {
  klump_enabled?: boolean | null;
  klump_max_amount?: number | null;
  klump_min_amount?: number | null;
}

interface BuildKlumpInitializePayloadInput {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  merchantId: string;
  orderId: string;
  orderTotal: number;
}

interface BuildKlumpBnplRouteParamsInput {
  amount: number;
  authorizationUrl: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  orderId: string;
  reference: string;
  merchantDomain?: string;
  merchantSlug?: string;
  trackingToken?: string | null;
}

export function formatKlumpAmount(amount: number) {
  return `₦${Math.round(amount).toLocaleString('en-US')}`;
}

export function getKlumpDisabledReason(
  settings: KlumpPaymentSettings | undefined | null,
  orderTotal: number,
  walletSelection?: WalletSelection,
  savingsSelection?: SavingsSelection
): string | undefined {
  if (walletSelection?.use === true && (walletSelection.amount ?? 0) > 0) {
    return 'Wallet credit cannot be combined with Klump';
  }

  if (savingsSelection?.use === true && (savingsSelection.amount ?? 0) > 0) {
    return 'Savings plan cannot be combined with Klump';
  }

  if (!settings?.klump_enabled) {
    return 'Klump is not available for this merchant';
  }

  const minAmount = settings.klump_min_amount ?? 10_000;
  if (orderTotal < minAmount) {
    return `Minimum order: ${formatKlumpAmount(minAmount)}`;
  }

  const maxAmount = settings.klump_max_amount ?? 1_000_000;
  if (orderTotal > maxAmount) {
    return `Maximum order: ${formatKlumpAmount(maxAmount)}`;
  }

  return undefined;
}

export function buildKlumpInitializePayload({
  customerEmail,
  customerName,
  customerPhone,
  merchantId,
  orderId,
  orderTotal,
}: BuildKlumpInitializePayloadInput) {
  return {
    amount: orderTotal,
    currency: 'NGN',
    customer_email: customerEmail,
    customer_name: customerName,
    customer_phone: customerPhone,
    gateway: 'klump',
    merchant_id: merchantId,
    order_id: orderId,
  } as const;
}

export function buildKlumpBnplRouteParams({
  amount,
  authorizationUrl,
  customerEmail,
  customerName,
  customerPhone,
  orderId,
  reference,
  merchantDomain,
  merchantSlug,
  trackingToken,
}: BuildKlumpBnplRouteParamsInput) {
  return {
    amount: String(amount),
    authorizationUrl,
    customerEmail,
    customerName,
    customerPhone,
    gateway: 'klump',
    orderId,
    reference,
    ...(merchantSlug ? { merchantSlug } : {}),
    ...(merchantDomain ? { merchantDomain } : {}),
    ...(trackingToken ? { trackingToken } : {}),
  } as const;
}
