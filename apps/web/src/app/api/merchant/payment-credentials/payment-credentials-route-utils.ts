import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type {
  MerchantPaymentCredentialMetaRow,
  PaymentCredentialEnvironment,
} from '@/lib/payments/merchant-credentials';
import type { PayPalMode } from '@/lib/paypal';

const PRIVATE_NO_STORE =
  'private, no-store, no-cache, max-age=0, must-revalidate';

interface PaymentCredentialRoleView {
  role: MerchantPaymentCredentialMetaRow['credential_role'];
  environment: MerchantPaymentCredentialMetaRow['environment'];
  last4: string | null;
  isActive: boolean;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
}

export interface PaymentCredentialStatusResponse {
  configured: boolean;
  roles: PaymentCredentialRoleView[];
}

export function jsonNoStore<T>(body: T, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', PRIVATE_NO_STORE);
  return NextResponse.json(body, { ...init, headers });
}

export function withNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', PRIVATE_NO_STORE);
  return response;
}

export function toStatusResponse(
  rows: MerchantPaymentCredentialMetaRow[]
): PaymentCredentialStatusResponse {
  const roles: PaymentCredentialRoleView[] = rows.map((row) => ({
    role: row.credential_role,
    environment: row.environment,
    last4: row.key_last4,
    isActive: row.is_active,
    lastValidatedAt: row.last_validated_at,
    lastValidationError: row.last_validation_error,
  }));

  const configured = roles.some(
    (role) => role.role === 'secret_key' && role.isActive
  );

  return { configured, roles };
}

export function toPayPalMode(
  environment: PaymentCredentialEnvironment
): PayPalMode {
  return environment === 'live' ? 'live' : 'sandbox';
}

/**
 * PayPal refunds remain available for 180 days. Completed payments and refunds
 * still in flight therefore depend on the live app credentials that created
 * them; callers use this guard before replacing or deleting those credentials.
 */
export async function hasRefundablePaypalPayments(
  supabase: SupabaseClient,
  merchantId: string
): Promise<boolean> {
  const refundableSince = new Date(
    Date.now() - 180 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('gateway', 'paypal')
    .eq('transaction_type', 'payment')
    .in('status', ['completed', 'refund_pending'])
    .gte('created_at', refundableSince)
    .limit(1);

  if (error) {
    throw new Error(
      `Failed to check refundable PayPal payments: ${error.message}`
    );
  }
  return (data?.length ?? 0) > 0;
}
