const PAYSTACK_DVA_WINDOW_MS = 90 * 60 * 1000;
const PAYSTACK_DVA_PAYMENT_STATUSES = [
  'unpaid',
  'pending',
  'partially_paid',
] as const;
const POSTGRES_UNIQUE_VIOLATION = '23505';

type PaymentAccountTiming = {
  assigned_at?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
  provider?: string | null;
};

type PaymentAccount = PaymentAccountTiming & {
  account_name: string;
  account_number: string;
  bank_name: string;
};

function toVirtualAccount(account: PaymentAccount) {
  return {
    account_name: account.account_name,
    account_number: account.account_number,
    bank_name: account.bank_name,
  };
}

function isActivePaymentAccount(
  account: PaymentAccountTiming,
  now = new Date()
): boolean {
  if (account.provider !== 'paystack') {
    return true;
  }

  const nowMs = now.getTime();
  const expiresAt = account.expires_at
    ? Date.parse(account.expires_at)
    : Number.NaN;
  if (Number.isFinite(expiresAt) && nowMs >= expiresAt) {
    return false;
  }

  const assignedAt = account.assigned_at
    ? Date.parse(account.assigned_at)
    : account.created_at
      ? Date.parse(account.created_at)
      : Number.NaN;
  if (!Number.isFinite(assignedAt)) {
    return true;
  }

  return nowMs >= assignedAt && nowMs <= assignedAt + PAYSTACK_DVA_WINDOW_MS;
}

function isEligibleOrderForPaystackDva(order: {
  cancelled_at?: string | null;
  payment_status?: string | null;
  shipping_status?: string | null;
}) {
  return (
    PAYSTACK_DVA_PAYMENT_STATUSES.includes(
      order.payment_status as (typeof PAYSTACK_DVA_PAYMENT_STATUSES)[number]
    ) &&
    order.shipping_status !== 'cancelled' &&
    order.shipping_status !== 'canceled' &&
    !order.cancelled_at
  );
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

function toCustomerName(customerName: string | null) {
  const nameParts = (customerName || 'Customer').trim().split(' ');
  return {
    firstName: nameParts[0] || 'Customer',
    lastName: nameParts.slice(1).join(' ') || 'User',
  };
}

function createAssignmentWindow(now = new Date()) {
  return {
    assignedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PAYSTACK_DVA_WINDOW_MS).toISOString(),
  };
}

export const generateDvaHelpers = {
  createAssignmentWindow,
  isActivePaymentAccount,
  isEligibleOrderForPaystackDva,
  isUniqueViolation,
  PAYSTACK_DVA_WINDOW_MS,
  toCustomerName,
  toVirtualAccount,
};
