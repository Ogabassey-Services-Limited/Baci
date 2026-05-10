import type { GPTLineItem, GPTTotal } from '@/lib/agentic/checkout';

export interface AgenticCheckoutBuyer {
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
}

interface StoredCheckoutCompletionSession {
  currency: string;
  metadata?: unknown;
  order_id?: string | null;
  payment_reference?: string | null;
  session_id: string;
  shipping_address?: unknown;
  shipping_method?: string | null;
  virtual_account_bank?: string | null;
  virtual_account_name?: string | null;
  virtual_account_number?: string | null;
}

export interface CheckoutPaymentSideEffectSession {
  metadata?: unknown;
  order_id?: string | null;
  payment_reference?: string | null;
  virtual_account_number?: string | null;
}

export interface StoredDvaAccount {
  account_name: string;
  account_number: string;
  bank_name: string;
}

interface PaymentPendingResponseInput {
  buyer: AgenticCheckoutBuyer;
  dvaAccount: StoredDvaAccount;
  orderId?: string | null;
  session: StoredCheckoutCompletionSession;
  sessionCalc: CheckoutPaymentSnapshot;
}

export interface CheckoutPaymentSnapshot {
  lineItems: GPTLineItem[];
  totals: GPTTotal[];
}

export function buildPaymentPendingCheckoutResponse({
  buyer,
  dvaAccount,
  orderId,
  session,
  sessionCalc,
}: PaymentPendingResponseInput) {
  return {
    id: session.session_id,
    buyer,
    status: 'ready_for_payment',
    currency: session.currency.toLowerCase(),
    line_items: sessionCalc.lineItems,
    shipping_address: session.shipping_address,
    fulfillment_option_id: session.shipping_method,
    totals: sessionCalc.totals,
    order: orderId
      ? {
          id: orderId,
          status: 'payment_pending',
        }
      : null,
    order_id: orderId ?? null,
    payment_details: {
      type: 'bank_transfer',
      bank_name: dvaAccount.bank_name ?? '',
      account_number: dvaAccount.account_number,
      account_name: dvaAccount.account_name ?? '',
      message:
        'Please transfer the exact total to this account to complete your order.',
    },
    messages: [
      {
        code: 'payment_pending',
        content:
          'Bank transfer account generated. Complete payment to confirm the order.',
        content_type: 'plain',
        type: 'info',
      },
    ],
    links: [],
  };
}

export function resolveExistingPaymentState({
  buyer,
  session,
  sessionCalc,
}: {
  buyer?: AgenticCheckoutBuyer;
  session: StoredCheckoutCompletionSession;
  sessionCalc?: CheckoutPaymentSnapshot;
}) {
  const paymentState = getAgenticPaymentState(session.metadata);
  const dvaAccount = getStoredDvaAccount(session);

  if (paymentState === 'payment_pending' && dvaAccount && session.order_id) {
    const storedBuyer = getAgenticMetadataValue(session.metadata, 'buyer');
    const responseBuyer = isAgenticCheckoutBuyer(storedBuyer)
      ? storedBuyer
      : buyer;
    const responseSessionCalc =
      getStoredCheckoutPaymentSnapshot(session.metadata) ?? sessionCalc;

    if (!responseBuyer || !responseSessionCalc) {
      return {
        body: {
          error: 'Session already has pending payment',
          order_id: session.order_id ?? null,
          status: 'payment_pending',
        },
        status: 409,
      };
    }

    return {
      body: buildPaymentPendingCheckoutResponse({
        buyer: responseBuyer,
        dvaAccount,
        orderId: session.order_id,
        session,
        sessionCalc: responseSessionCalc,
      }),
      status: 200,
    };
  }

  if (hasCheckoutPaymentSideEffect(session)) {
    return {
      body: {
        error: 'Session already has pending payment',
        order_id: session.order_id ?? null,
        status: 'payment_pending',
      },
      status: 409,
    };
  }

  return null;
}

export function hasCheckoutPaymentSideEffect(
  session: CheckoutPaymentSideEffectSession
): boolean {
  const paymentState = getAgenticPaymentState(session.metadata);

  return (
    paymentState === 'claiming_payment' ||
    paymentState === 'payment_account_ready' ||
    paymentState === 'order_finalizing' ||
    paymentState === 'payment_pending' ||
    !!session.order_id ||
    !!session.payment_reference ||
    !!session.virtual_account_number
  );
}

export function getStoredDvaAccount(
  session: StoredCheckoutCompletionSession
): StoredDvaAccount | null {
  const metadataDva = getAgenticMetadataValue(session.metadata, 'dva_account');

  if (
    metadataDva &&
    typeof metadataDva === 'object' &&
    'account_number' in metadataDva
  ) {
    const account = metadataDva as Record<string, unknown>;
    const accountNumber = account.account_number;
    if (typeof accountNumber !== 'string' || !accountNumber) {
      return null;
    }

    return {
      account_name:
        typeof account.account_name === 'string' ? account.account_name : '',
      account_number: accountNumber,
      bank_name: typeof account.bank_name === 'string' ? account.bank_name : '',
    };
  }

  const accountNumber =
    session.virtual_account_number ?? session.payment_reference ?? null;
  if (!accountNumber) {
    return null;
  }

  return {
    account_name: session.virtual_account_name ?? '',
    account_number: accountNumber,
    bank_name: session.virtual_account_bank ?? '',
  };
}

export function getAgenticPaymentState(metadata: unknown): string | null {
  const value = getAgenticMetadataValue(metadata, 'payment_state');
  return typeof value === 'string' ? value : null;
}

export function getAgenticPaymentMethod(metadata: unknown): string | null {
  const value = getAgenticMetadataValue(metadata, 'payment_method');
  return typeof value === 'string' ? value : null;
}

function getAgenticMetadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || !('agentic' in metadata)) {
    return undefined;
  }

  const agentic = (metadata as { agentic?: unknown }).agentic;
  if (!agentic || typeof agentic !== 'object' || !(key in agentic)) {
    return undefined;
  }

  return (agentic as Record<string, unknown>)[key];
}

export function getStoredCheckoutPaymentSnapshot(
  metadata: unknown
): CheckoutPaymentSnapshot | null {
  const lineItems = getAgenticMetadataValue(metadata, 'line_items');
  const totals = getAgenticMetadataValue(metadata, 'totals');

  if (
    !Array.isArray(lineItems) ||
    !Array.isArray(totals) ||
    !lineItems.every(isStoredLineItem) ||
    !totals.every(isStoredTotal)
  ) {
    return null;
  }

  return {
    lineItems: lineItems as GPTLineItem[],
    totals: totals as GPTTotal[],
  };
}

function isStoredLineItem(value: unknown): value is GPTLineItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const lineItem = value as Record<string, unknown>;
  const item = lineItem.item;

  return (
    typeof lineItem.id === 'string' &&
    typeof lineItem.base_amount === 'number' &&
    typeof lineItem.discount === 'number' &&
    typeof lineItem.subtotal === 'number' &&
    typeof lineItem.tax === 'number' &&
    typeof lineItem.total === 'number' &&
    !!item &&
    typeof item === 'object' &&
    typeof (item as Record<string, unknown>).id === 'string' &&
    typeof (item as Record<string, unknown>).product_id === 'string' &&
    typeof (item as Record<string, unknown>).quantity === 'number'
  );
}

function isStoredTotal(value: unknown): value is GPTTotal {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const total = value as Record<string, unknown>;

  return (
    typeof total.type === 'string' &&
    typeof total.display_text === 'string' &&
    (typeof total.amount === 'number' || typeof total.amount === 'string')
  );
}

function isAgenticCheckoutBuyer(value: unknown): value is AgenticCheckoutBuyer {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const buyer = value as Record<string, unknown>;

  return (
    typeof buyer.email === 'string' &&
    typeof buyer.first_name === 'string' &&
    typeof buyer.last_name === 'string' &&
    typeof buyer.phone_number === 'string'
  );
}
