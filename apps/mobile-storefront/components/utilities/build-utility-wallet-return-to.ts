import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import type { ValidUtilityType } from './utility-purchase.types';

interface BuildUtilityWalletReturnToArgs {
  amount?: number;
  billItemIdentifier?: string | null;
  billerName?: string | null;
  customerAddress?: string | null;
  customerIdentifier?: string | null;
  customerName?: string | null;
  dataPlanCode?: string | null;
  networkProvider?: string | null;
  phoneNumber?: string | null;
  type: ValidUtilityType;
  verified?: boolean;
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Builds a `/utilities/<type>?repeat…` deep-link that `RouteRepeatParamsSchema`
 * prefills back into the utility form. Each value is `encodeURIComponent`'d
 * exactly once; callers that embed the result in a `?returnTo=` URL must
 * `encodeURIComponent` the whole href once more (never double-encode values).
 * The returned link only PREFILLS — it never triggers a purchase.
 */
export function buildUtilityWalletReturnTo({
  amount,
  billItemIdentifier,
  billerName,
  customerAddress,
  customerIdentifier,
  customerName,
  dataPlanCode,
  networkProvider,
  phoneNumber,
  type,
  verified,
}: BuildUtilityWalletReturnToArgs): WalletReturnHref {
  const params: string[] = [];
  const push = (key: string, value: string) => {
    params.push(`${key}=${encodeURIComponent(value)}`);
  };

  if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
    push('repeatAmount', String(amount));
  }
  if (isNonEmpty(phoneNumber)) {
    push('repeatPhoneNumber', phoneNumber.trim());
  }
  if (isNonEmpty(networkProvider)) {
    push('repeatNetworkProvider', networkProvider.trim());
  }
  if (isNonEmpty(dataPlanCode)) {
    push('repeatDataPlanCode', dataPlanCode.trim());
  }
  if (isNonEmpty(customerIdentifier)) {
    push('repeatCustomerIdentifier', customerIdentifier.trim());
  }
  if (isNonEmpty(billerName)) {
    push('repeatBillerName', billerName.trim());
  }
  if (isNonEmpty(billItemIdentifier)) {
    push('repeatBillItemIdentifier', billItemIdentifier.trim());
  }
  if (isNonEmpty(customerName)) {
    push('repeatCustomerName', customerName.trim());
  }
  if (isNonEmpty(customerAddress)) {
    push('repeatCustomerAddress', customerAddress.trim());
  }
  if (verified === true) {
    push('repeatVerified', '1');
  }

  const query = params.length > 0 ? `?${params.join('&')}` : '';
  return `/utilities/${type}${query}` as WalletReturnHref;
}
