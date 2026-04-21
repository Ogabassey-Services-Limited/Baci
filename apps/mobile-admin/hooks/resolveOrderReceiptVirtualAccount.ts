import { getBankNameFromCode } from '@baci/shared';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';

interface ReceiptMerchantDetails {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_code?: string | null;
  business_name?: string | null;
}

interface VirtualAccountPayload {
  account_name?: string;
  account_number?: string;
  bank_name?: string;
}

interface GenerateDvaResponse {
  virtualAccount?: VirtualAccountPayload;
}

interface VirtualTerminalEntry {
  account_name?: string;
  account_number?: string;
  active?: boolean;
  bank?: string;
}

interface VirtualTerminalResponse {
  terminals?: VirtualTerminalEntry[];
}

interface ResolveAccountResponse {
  account_name?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
  } catch {}

  if (order.payment_status === 'paid') {
    return order.virtual_account ?? null;
  }

  let virtualAccount = order.virtual_account ?? order.staff_terminal ?? null;

  if (!virtualAccount) {
    try {
      if (session?.access_token) {
        const response = await fetch(
          `${BASE_URL}/api/orders/${order.id}/generate-dva`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            method: 'POST',
          }
        );

        if (response.ok) {
          const payload = (await response.json()) as unknown;
          if (isRecord(payload) && isRecord(payload.virtualAccount)) {
            const typed = payload as GenerateDvaResponse;
            const va = typed.virtualAccount;
            if (va?.account_number) {
              virtualAccount = {
                account_name: va.account_name || '',
                account_number: va.account_number,
                bank_name: va.bank_name || '',
              };
            }
          }
        }
      }
    } catch {}
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
          const payload = (await response.json()) as unknown;
          if (isRecord(payload) && Array.isArray(payload.terminals)) {
            const typed = payload as VirtualTerminalResponse;
            const terminal = typed.terminals?.find((entry) => entry.active);
            if (terminal?.account_number) {
              virtualAccount = {
                account_name: terminal.account_name || '',
                account_number: terminal.account_number,
                bank_name: terminal.bank || '',
              };
            }
          }
        }
      }
    } catch {}
  }

  if (!virtualAccount && merchant?.bank_account_number && merchant.bank_code) {
    let resolvedName = merchant.bank_account_name || '';
    const bankName = getBankNameFromCode(merchant.bank_code) || '';

    if (!resolvedName || resolvedName === merchant.business_name) {
      try {
        if (session?.access_token) {
          const response = await fetch(`${BASE_URL}/api/paystack/resolve`, {
            body: JSON.stringify({
              accountNumber: merchant.bank_account_number,
              bankCode: merchant.bank_code,
            }),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            method: 'POST',
          });

          if (response.ok) {
            const payload = (await response.json()) as unknown;
            if (isRecord(payload)) {
              const typed = payload as ResolveAccountResponse;
              if (typed.account_name) {
                resolvedName = typed.account_name;
              }
            }
          }
        }
      } catch {}
    }

    virtualAccount = {
      account_name: resolvedName || merchant.business_name || 'Business',
      account_number: merchant.bank_account_number,
      bank_name: bankName,
    };
  }

  return virtualAccount;
}
