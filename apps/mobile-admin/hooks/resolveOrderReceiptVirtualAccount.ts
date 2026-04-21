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

function resolveAccountCandidate(
  account:
    | {
        account_name?: string | null;
        account_number?: string | null;
        bank?: string | null;
        bank_name?: string | null;
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

  return {
    account_name: account.account_name?.trim() || '',
    account_number: accountNumber,
    bank_name: account.bank_name?.trim() || account.bank?.trim() || '',
  };
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

  let virtualAccount =
    resolveAccountCandidate(order.virtual_account) ??
    resolveAccountCandidate(order.staff_terminal);

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
          virtualAccount = resolveAccountCandidate(payload.virtualAccount);
        }
      }
    } catch {
      // Ignore dynamic account generation failures and continue to the next fallback.
    }
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
          const payload = await response.json();
          const terminal = payload.terminals?.find(
            (entry: { active: boolean }) => entry.active
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
            const payload: { account_name?: string } = await response.json();
            if (payload.account_name) {
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
