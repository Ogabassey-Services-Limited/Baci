import { isDeepStrictEqual } from 'node:util';
import {
  type AgenticCheckoutBuyer,
  buildPaymentPendingCheckoutResponse,
  getAgenticMetadataValue,
  getAgenticPaymentState,
  getStoredCheckoutPaymentSnapshot,
  type StoredCheckoutCompletionSession,
  type StoredDvaAccount,
} from './checkout-completion-response';

const SHA_256_PATTERN = /^[a-f0-9]{64}$/;

interface StoredReplay {
  requestHash: string;
  response: unknown;
  status: number;
}

export function resolveGrandfatheredPaymentPendingReplay({
  replay,
  session,
}: {
  replay: StoredReplay;
  session: StoredCheckoutCompletionSession;
}): { body: unknown; status: 200 } | null {
  if (replay.status !== 200 || !SHA_256_PATTERN.test(replay.requestHash)) {
    return null;
  }
  if (
    session.status !== 'processing' ||
    typeof session.currency !== 'string' ||
    session.currency.toUpperCase() !== 'NGN' ||
    session.payment_method !== 'bank_transfer' ||
    session.payment_provider !== 'paystack' ||
    getAgenticPaymentState(session.metadata) !== 'payment_pending' ||
    !session.order_id
  ) {
    return null;
  }

  const buyer = getStoredBuyer(session.metadata);
  const dvaAccount = getConsistentStoredDvaAccount(session);
  const sessionCalc = getStoredCheckoutPaymentSnapshot(session.metadata);
  if (
    !buyer ||
    !dvaAccount ||
    !sessionCalc ||
    session.customer_email !== buyer.email ||
    session.customer_phone !== buyer.phone_number ||
    session.customer_name !== getBuyerDisplayName(buyer)
  ) {
    return null;
  }

  let expectedResponse: unknown;
  try {
    expectedResponse = toJsonValue(
      buildPaymentPendingCheckoutResponse({
        buyer,
        dvaAccount,
        orderId: session.order_id,
        session,
        sessionCalc,
      })
    );
  } catch {
    return null;
  }
  const storedResponse = toJsonValue(replay.response);
  if (
    expectedResponse === null ||
    storedResponse === null ||
    !isDeepStrictEqual(expectedResponse, storedResponse)
  ) {
    return null;
  }

  return { body: replay.response, status: 200 };
}

function getConsistentStoredDvaAccount(
  session: StoredCheckoutCompletionSession
): StoredDvaAccount | null {
  const stored = getAgenticMetadataValue(session.metadata, 'dva_account');
  if (!stored || typeof stored !== 'object') return null;

  const account = stored as Record<string, unknown>;
  if (
    typeof account.account_name !== 'string' ||
    typeof account.account_number !== 'string' ||
    typeof account.bank_name !== 'string' ||
    account.account_name.trim().length === 0 ||
    account.account_number.trim().length === 0 ||
    account.bank_name.trim().length === 0
  ) {
    return null;
  }
  if (
    session.payment_reference !== account.account_number ||
    session.virtual_account_number !== account.account_number ||
    session.virtual_account_name !== account.account_name ||
    session.virtual_account_bank !== account.bank_name
  ) {
    return null;
  }

  return {
    account_name: account.account_name,
    account_number: account.account_number,
    bank_name: account.bank_name,
  };
}

function getStoredBuyer(metadata: unknown): AgenticCheckoutBuyer | null {
  const stored = getAgenticMetadataValue(metadata, 'buyer');
  if (!stored || typeof stored !== 'object') return null;

  const buyer = stored as Record<string, unknown>;
  if (
    typeof buyer.email !== 'string' ||
    typeof buyer.first_name !== 'string' ||
    typeof buyer.last_name !== 'string' ||
    typeof buyer.phone_number !== 'string' ||
    buyer.email.trim().length === 0 ||
    buyer.first_name.trim().length === 0 ||
    buyer.last_name.trim().length === 0 ||
    buyer.phone_number.trim().length === 0
  ) {
    return null;
  }

  return {
    email: buyer.email,
    first_name: buyer.first_name,
    last_name: buyer.last_name,
    phone_number: buyer.phone_number,
  };
}

function getBuyerDisplayName(buyer: AgenticCheckoutBuyer): string {
  return [buyer.first_name, buyer.last_name]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

function toJsonValue(value: unknown): unknown | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : JSON.parse(serialized);
  } catch {
    return null;
  }
}
