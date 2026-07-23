import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import { NigerianPhoneSchema } from '@/lib/validation/auth-schemas';
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
 * The href is built from a form the customer is still typing into, so the phone
 * can be a partial value. `RouteRepeatParamsSchema` pipes `repeatPhoneNumber`
 * through `NigerianPhoneSchema` and `safeParse`s the repeat params as ONE
 * object, so an unparseable phone throws away every other repeat param too and
 * the "Return to your purchase" CTA lands on an empty form. Omit the phone
 * unless it round-trips, so the amount/provider/plan still prefill.
 */
function isRoundTrippablePhone(value: string): boolean {
  return NigerianPhoneSchema.safeParse(value).success;
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
  if (isNonEmpty(phoneNumber) && isRoundTrippablePhone(phoneNumber.trim())) {
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
