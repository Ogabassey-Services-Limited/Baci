import { getBankNameFromCode } from '@baci/shared';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { createAuthenticatedFetch } from './orders/authenticated-fetch';

const GENERATE_DVA_TIMEOUT_MS = 20_000;
const PAYSTACK_DVA_PAYMENT_STATUSES = [
  'unpaid',
  'pending',
  'partially_paid',
] as const;
const PAYSTACK_DVA_WINDOW_MS = 90 * 60 * 1000;

interface ReceiptMerchantDetails {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_code?: string | null;
  business_name?: string | null;
}

interface GenerateDvaResponse {
  virtualAccount?: {
    account_name?: string | null;
    account_number?: string | null;
    bank?: string | null;
    bank_name?: string | null;
  } | null;
}

interface VirtualTerminalEntry {
  account_name?: string | null;
  account_number?: string | null;
  active?: boolean;
  bank?: string | null;
  bank_name?: string | null;
}

interface VirtualTerminalResponse {
  terminals?: VirtualTerminalEntry[] | null;
}

interface ResolveAccountNameResponse {
  account_name?: string | null;
}

function resolveAccountCandidate(
  account:
    | {
        account_name?: string | null;
        account_number?: string | null;
        assigned_at?: string | null;
        bank?: string | null;
        bank_name?: string | null;
        created_at?: string | null;
        expires_at?: string | null;
        provider?: string | null;
      }
    | null
    | undefined
) {
  if (!account) {
    return null;
  }

  const accountNumber = account.account_number?.trim();
  if (!accountNumber) {
    return null;
  }

  if (account.provider === 'paystack') {
    const nowMs = Date.now();
    const expiresAt = account.expires_at
      ? Date.parse(account.expires_at)
      : Number.NaN;
    if (Number.isFinite(expiresAt) && nowMs >= expiresAt) {
      return null;
    }

    const assignedAt = account.assigned_at
      ? Date.parse(account.assigned_at)
      : account.created_at
        ? Date.parse(account.created_at)
        : Number.NaN;
    if (
      Number.isFinite(assignedAt) &&
      (nowMs < assignedAt || nowMs > assignedAt + PAYSTACK_DVA_WINDOW_MS)
    ) {
      return null;
    }
  }

  return {
    account_name: account.account_name?.trim() || '',
    account_number: accountNumber,
    bank_name: account.bank_name?.trim() || account.bank?.trim() || '',
  };
}

function canProvisionPaystackDva(order: OrderDetailsRecord) {
  const currency = (order.currency || 'NGN').trim().toUpperCase();
  return (
    currency === 'NGN' &&
    PAYSTACK_DVA_PAYMENT_STATUSES.includes(
      order.payment_status as (typeof PAYSTACK_DVA_PAYMENT_STATUSES)[number]
    ) &&
    order.shipping_status !== 'cancelled' &&
    !order.cancelled_at &&
    Boolean(order.customer_email?.trim())
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseGenerateDvaResponse(
  payload: unknown
): GenerateDvaResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    !('virtualAccount' in payload) ||
    (payload.virtualAccount !== null && !isRecord(payload.virtualAccount))
  ) {
    return null;
  }

  return payload as GenerateDvaResponse;
}

function parseVirtualTerminalResponse(
  payload: unknown
): VirtualTerminalResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    !('terminals' in payload) ||
    (payload.terminals !== null && !Array.isArray(payload.terminals))
  ) {
    return null;
  }

  return payload as VirtualTerminalResponse;
}

function parseResolveAccountNameResponse(
  payload: unknown
): ResolveAccountNameResponse | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (
    !('account_name' in payload) ||
    (payload.account_name !== null &&
      payload.account_name !== undefined &&
      typeof payload.account_name !== 'string')
  ) {
    return null;
  }

  return payload as ResolveAccountNameResponse;
}

export async function resolveOrderReceiptVirtualAccount({
  merchant,
  order,
}: {
  merchant: ReceiptMerchantDetails | null | undefined;
  order: OrderDetailsRecord;
}) {
  let session = null;

  try {
    const {
      data: { session: nextSession },
    } = await supabase.auth.getSession();
    session = nextSession;
  } catch {
    // Ignore session lookup failures and continue with non-authenticated fallbacks.
  }

  if (order.payment_status === 'paid') {
    return resolveAccountCandidate(order.virtual_account);
  }

  const shouldProvisionPaystackDva = canProvisionPaystackDva(order);

  // Re-check Paystack accounts through the server so merchant gateway
  // disablement and the authoritative assignment window are enforced.
  let virtualAccount =
    order.virtual_account?.provider !== 'paystack'
      ? resolveAccountCandidate(order.virtual_account)
      : null;

  if (!virtualAccount && shouldProvisionPaystackDva) {
    try {
      if (session?.access_token) {
        const response = await createAuthenticatedFetch(
          `${BASE_URL}/api/orders/${order.id}/generate-dva`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            method: 'POST',
          },
          GENERATE_DVA_TIMEOUT_MS
        );

        if (response.ok) {
          const payload = parseGenerateDvaResponse(await response.json());
          virtualAccount = resolveAccountCandidate(payload?.virtualAccount);
        }
      }
    } catch {
      // Ignore invoice account provisioning failures and continue to fallbacks.
    }
  }

  if (!virtualAccount) {
    virtualAccount = resolveAccountCandidate(order.staff_terminal);
  }

  if (!virtualAccount) {
    try {
      if (session?.access_token) {
        const response = await fetch(
          `${BASE_URL}/api/paystack/virtual-terminal`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );

        if (response.ok) {
          const payload = parseVirtualTerminalResponse(await response.json());
          const terminal = payload?.terminals?.find(
            (entry) => entry.active && entry.account_number?.trim()
          );

          if (terminal?.account_number) {
            virtualAccount = resolveAccountCandidate(terminal);
          }
        }
      }
    } catch {
      // Ignore virtual terminal lookup failures and continue to the next fallback.
    }
  }

  const merchantAccountNumber = merchant?.bank_account_number?.trim();
  const merchantBankCode = merchant?.bank_code?.trim();
  if (
    !virtualAccount &&
    merchant &&
    merchantAccountNumber &&
    merchantBankCode
  ) {
    let resolvedName = merchant.bank_account_name || '';
    const bankName = getBankNameFromCode(merchantBankCode) || '';

    if (!resolvedName || resolvedName === merchant.business_name) {
      try {
        if (session?.access_token) {
          const response = await fetch(`${BASE_URL}/api/paystack/resolve`, {
            body: JSON.stringify({
              accountNumber: merchantAccountNumber,
              bankCode: merchantBankCode,
            }),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            method: 'POST',
          });

          if (response.ok) {
            const payload = parseResolveAccountNameResponse(
              await response.json()
            );
            if (payload?.account_name) {
              resolvedName = payload.account_name;
            }
          }
        }
      } catch {
        // Ignore account-name resolution failures and fall back to the merchant name.
      }
    }

    virtualAccount = {
      account_name: resolvedName || merchant.business_name || 'Business',
      account_number: merchantAccountNumber,
      bank_name: bankName,
    };
  }

  return virtualAccount;
}
