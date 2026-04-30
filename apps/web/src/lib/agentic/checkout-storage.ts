import type {
  CheckoutItem,
  GPTFulfillmentOption,
  GPTLineItem,
  GPTMessage,
  GPTTotal,
} from '@/lib/agentic/checkout';

const INTERNAL_READY_STATUS = 'processing';
const INTERNAL_NOT_READY_STATUS = 'pending';

export type StoredCheckoutStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'expired'
  | 'abandoned'
  | 'failed';

export type AgentCheckoutStatus =
  | 'not_ready_for_payment'
  | 'ready_for_payment'
  | 'completed'
  | 'canceled';

export type AgenticMetadata = Record<string, unknown> & {
  agentic?: Record<string, unknown>;
};

type FulfillmentAddress = Record<string, unknown> | null;

interface CheckoutStorageState {
  currency: string;
  existingMetadata?: AgenticMetadata | null;
  fulfillmentAddress?: FulfillmentAddress;
  fulfillmentOptionId?: string | null;
  fulfillmentOptions: GPTFulfillmentOption[];
  items: CheckoutItem[];
  lineItems: GPTLineItem[];
  messages: GPTMessage[];
  totals: GPTTotal[];
}

interface CheckoutSessionInsertInput extends CheckoutStorageState {
  merchantId: string;
  sessionId: string;
}

export function getTotalAmount(totals: GPTTotal[]): number {
  return getAmountForTotalType(totals, 'total');
}

export function getSubtotalAmount(totals: GPTTotal[]): number {
  return (
    getAmountForTotalType(totals, 'subtotal') ||
    getAmountForTotalType(totals, 'items_base_amount')
  );
}

export function getFulfillmentAmount(totals: GPTTotal[]): number {
  return getAmountForTotalType(totals, 'fulfillment');
}

export function mapCheckoutSessionStatus({
  hasFulfillmentAddress = false,
  hasLineItems = false,
  status,
}: {
  hasFulfillmentAddress?: boolean;
  hasLineItems?: boolean;
  status: StoredCheckoutStatus;
}): AgentCheckoutStatus {
  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'abandoned' || status === 'expired' || status === 'failed') {
    return 'canceled';
  }

  if (
    status === INTERNAL_READY_STATUS &&
    hasFulfillmentAddress &&
    hasLineItems
  ) {
    return 'ready_for_payment';
  }

  return 'not_ready_for_payment';
}

export function buildAgenticMetadata({
  existingMetadata,
  fulfillmentOptions,
  lineItems,
  messages,
  totals,
}: {
  existingMetadata?: AgenticMetadata | null;
  fulfillmentOptions: GPTFulfillmentOption[];
  lineItems: GPTLineItem[];
  messages: GPTMessage[];
  totals: GPTTotal[];
}): AgenticMetadata {
  return {
    ...(existingMetadata ?? {}),
    agentic: {
      ...getExistingAgenticMetadata(existingMetadata),
      fulfillment_options: fulfillmentOptions,
      line_items: lineItems,
      messages,
      totals,
    },
  };
}

export function buildCheckoutSessionInsert(input: CheckoutSessionInsertInput) {
  const state = buildStoredCheckoutState(input);

  return {
    ...state,
    merchant_id: input.merchantId,
    session_id: input.sessionId,
  };
}

export function buildCheckoutSessionUpdate(input: CheckoutStorageState) {
  return {
    ...buildStoredCheckoutState(input),
    updated_at: new Date().toISOString(),
  };
}

function buildStoredCheckoutState(input: CheckoutStorageState) {
  const totalAmount = getTotalAmount(input.totals);

  return {
    cart_items: input.items,
    cart_total: totalAmount,
    currency: input.currency.toUpperCase(),
    metadata: buildAgenticMetadata({
      existingMetadata: input.existingMetadata,
      fulfillmentOptions: input.fulfillmentOptions,
      lineItems: input.lineItems,
      messages: input.messages,
      totals: input.totals,
    }),
    shipping_address: input.fulfillmentAddress ?? null,
    shipping_cost: getFulfillmentAmount(input.totals),
    shipping_method: input.fulfillmentOptionId ?? null,
    status: getInternalCheckoutStatus(input),
    subtotal: getSubtotalAmount(input.totals),
    total_amount: totalAmount,
  };
}

function getInternalCheckoutStatus({
  fulfillmentAddress,
  lineItems,
}: CheckoutStorageState): 'pending' | 'processing' {
  if (fulfillmentAddress && lineItems.length > 0) {
    return INTERNAL_READY_STATUS;
  }

  return INTERNAL_NOT_READY_STATUS;
}

function getAmountForTotalType(
  totals: GPTTotal[],
  type: GPTTotal['type']
): number {
  const amount = totals.find((total) => total.type === type)?.amount;

  if (typeof amount === 'number') {
    return amount;
  }

  if (typeof amount === 'string') {
    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getExistingAgenticMetadata(
  existingMetadata?: AgenticMetadata | null
): Record<string, unknown> {
  if (
    existingMetadata?.agentic &&
    typeof existingMetadata.agentic === 'object' &&
    !Array.isArray(existingMetadata.agentic)
  ) {
    return existingMetadata.agentic;
  }

  return {};
}
