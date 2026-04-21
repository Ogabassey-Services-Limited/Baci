import { getBankNameFromCode } from '@baci/shared';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';

interface ReceiptMerchantDetails {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_code?: string | null;
  business_name?: string | null;
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
          const payload = await response.json();
          if (payload.virtualAccount?.account_number) {
            virtualAccount = {
              account_name: payload.virtualAccount.account_name || '',
              account_number: payload.virtualAccount.account_number,
              bank_name: payload.virtualAccount.bank_name || '',
            };
          }
        }
      }
    } catch {}
  }

  if (!virtualAccount) {
    try {
      if (session?.access_token) {
        const response = await fetch(`${BASE_URL}/api/paystack/virtual-terminal`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const payload = await response.json();
          const terminal = payload.terminals?.find(
            (entry: { active: boolean }) => entry.active
          );

          if (terminal?.account_number) {
            virtualAccount = {
              account_name: terminal.account_name || '',
              account_number: terminal.account_number,
              bank_name: terminal.bank || '',
            };
          }
        }
      }
    } catch {}
  }

  if (
    !virtualAccount &&
    merchant?.bank_account_number &&
    merchant.bank_code
  ) {
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
            const payload: { account_name?: string } = await response.json();
            if (payload.account_name) {
              resolvedName = payload.account_name;
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
