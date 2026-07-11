import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import { formatPrice } from '@/stores/cart-store';
import {
  BNPL_MAX_AMOUNT,
  BNPL_MIN_AMOUNT,
  type PaymentMethodType,
  type PaymentTab,
} from './types';

/**
 * A customer-facing payment *intent* — "how do I want to settle this order?" —
 * projected onto the existing (tab, method) state. Instrument-bearing intents
 * (`full`, `installments`) expand to nested instrument rows; the two `pay_later`
 * intents are terminal (selecting one sets both the tab and its method).
 *
 * Copy is intentionally plain/benefit-led. "Pay Small Small" is the local
 * (Nigerian) phrasing for installments; keep these strings here so they stay
 * centralized for later localization (NG is the pilot market, not the ceiling).
 */
export type PaymentIntentId = 'full' | 'installments' | 'payforme' | 'invoice';

export interface PaymentIntent {
  id: PaymentIntentId;
  tab: PaymentTab;
  /** Terminal method for `pay_later` intents (payforme/invoice); undefined otherwise. */
  method?: PaymentMethodType;
  label: string;
  subtitle: string;
  icon: IoniconsIconName;
}

export const PAYMENT_INTENTS: readonly PaymentIntent[] = [
  {
    id: 'full',
    tab: 'full',
    label: 'Pay in Full',
    subtitle: 'Pay now — we start processing your order right away',
    icon: 'flash-outline',
  },
  {
    id: 'installments',
    tab: 'installments',
    label: 'Pay Small Small',
    subtitle: 'Split your order into 3–6 monthly payments',
    icon: 'calendar-outline',
  },
  {
    id: 'payforme',
    tab: 'pay_later',
    method: 'payforme',
    label: 'Pay for Me',
    subtitle: 'Send this order to someone to pay for you',
    icon: 'people-outline',
  },
  {
    id: 'invoice',
    tab: 'pay_later',
    label: 'Generate Invoice',
    method: 'invoice',
    subtitle: 'Get an invoice to pay later or send to your company',
    icon: 'receipt-outline',
  },
] as const;

/** Whether an intent is the one currently selected, given the (tab, method) state. */
export function isIntentSelected(
  intent: PaymentIntent,
  selectedTab: PaymentTab | null,
  selectedMethod: PaymentMethodType | null
): boolean {
  if (intent.method) {
    return selectedTab === intent.tab && selectedMethod === intent.method;
  }
  return selectedTab === intent.tab;
}

/** Human-readable eligibility hint shown on a disabled "Pay Small Small" card. */
export function bnplEligibilityHint(orderTotal: number): string {
  if (Number.isFinite(orderTotal) && orderTotal > BNPL_MAX_AMOUNT) {
    return `Available for orders up to ${formatPrice(BNPL_MAX_AMOUNT)}`;
  }
  return `Available for orders from ${formatPrice(BNPL_MIN_AMOUNT)}`;
}
