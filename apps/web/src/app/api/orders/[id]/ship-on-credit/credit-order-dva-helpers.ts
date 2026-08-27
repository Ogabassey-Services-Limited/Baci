import {
  type OrderPaymentAccountLike,
  selectPreferredOrderPaymentAccount,
} from '@baci/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { persistPaystackDvaAssignment } from '@/lib/payments/persist-paystack-dva-assignment';
import { generatePaymentAccount } from '@/lib/paystack';

interface CreditOrderDvaAccount extends OrderPaymentAccountLike {
  account_name: string;
  bank_name: string;
}

interface ProvisionCreditOrderDvaInput {
  customerEmail: string | null;
  customerName: string | null;
  orderId: string;
  supabase: SupabaseClient;
}

async function provisionCreditOrderDva({
  customerEmail,
  customerName,
  orderId,
  supabase,
}: ProvisionCreditOrderDvaInput) {
  const normalizedEmail = customerEmail?.trim();
  if (!normalizedEmail) {
    logger.warn({
      message: 'Cannot create DVA for credit order without customer email',
      orderId,
    });
    return null;
  }

  try {
    const name = toCustomerName(customerName);
    const dvaResult = await generatePaymentAccount({
      email: normalizedEmail,
      firstName: name.firstName,
      lastName: name.lastName,
      phone: '',
      orderId,
    });

    if (!dvaResult.success) {
      return null;
    }

    const persistenceFailure = await persistPaystackDvaAssignment(supabase, {
      accountName: dvaResult.data.account_name,
      accountNumber: dvaResult.data.account_number,
      bankName: dvaResult.data.bank_name,
      customerEmail: normalizedEmail,
      orderId,
    });

    if (!persistenceFailure) {
      return toVirtualAccount(dvaResult.data);
    }

    const { data: existingAccount, error: existingAccountError } =
      await supabase
        .from('order_payment_accounts')
        .select(
          'account_number, bank_name, account_name, assignment_customer_email_source, assigned_at, created_at, expires_at, provider'
        )
        .eq('order_id', orderId)
        .eq('provider', 'paystack')
        .order('assigned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingAccountError) {
      logger.error({
        message: 'Database error fetching existing payment account',
        error: existingAccountError,
        orderId,
      });
      logger.warn({
        message:
          'Optional credit-order payment account lookup failed after shipping transition',
        error: existingAccountError,
        orderId,
      });
    }

    if (
      !existingAccountError &&
      existingAccount &&
      isReusableAccount(existingAccount)
    ) {
      logger.info({
        message:
          'Order payment account already exists, treating as idempotent success',
        orderId,
      });
      return toVirtualAccount(existingAccount);
    }

    logger.warn({
      message:
        'Optional credit-order payment account persistence failed after shipping transition',
      orderId,
    });
  } catch (error) {
    logger.warn({
      message: 'Could not create DVA for credit order',
      error,
    });
  }

  return null;
}

function isReusableAccount(account: CreditOrderDvaAccount) {
  return selectPreferredOrderPaymentAccount([account]) !== null;
}

function toCustomerName(customerName: string | null) {
  const parts = (customerName || 'Customer').trim().split(' ');
  return {
    firstName: parts[0] || 'Customer',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

function toVirtualAccount(account: CreditOrderDvaAccount) {
  return {
    account_number: account.account_number,
    bank_name: account.bank_name,
    account_name: account.account_name,
  };
}

export const creditOrderDvaHelpers = {
  isReusableAccount,
  provisionCreditOrderDva,
  toCustomerName,
  toVirtualAccount,
};
