import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { fetchMerchantPaystackSubaccountCode } from '@/lib/fetch-merchant-payment-secret';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { paystackSubaccountSchema } from '@/schemas/paystack-subaccount';
import { executePaystackSubaccountSave } from './execute-paystack-subaccount-save';

function hasRequestField(value: unknown, property: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.hasOwn(value, property)
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error ?? 'Unauthorized' },
        { status: 401 }
      );
    }

    const usingBearerAuth =
      request.headers.get('Authorization')?.startsWith('Bearer ') ?? false;
    if (!usingBearerAuth) {
      const csrf = await checkCsrfProtection(request);
      if (!csrf.valid) {
        return (
          csrf.response ??
          NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
        );
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const parseResult = paystackSubaccountSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      merchant_id,
      account_name,
      account_number,
      bank_code,
      bank_name,
      business_name,
      auto_payout_enabled,
    } = parseResult.data;

    if (!merchant_id) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    const shouldPersistAutoPayoutEnabled =
      hasRequestField(body, 'autoPayoutEnabled') ||
      hasRequestField(body, 'auto_payout_enabled');
    const hasExplicitPayoutMode =
      hasRequestField(body, 'payoutMode') ||
      hasRequestField(body, 'payout_mode');

    if (hasExplicitPayoutMode) {
      return NextResponse.json(
        {
          error:
            'Payout mode is no longer supported in the bank details save flow',
        },
        { status: 400 }
      );
    }

    // 1. Get Merchant Context (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: merchant_id }
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (shouldPersistAutoPayoutEnabled && !access.isOwner) {
      return NextResponse.json(
        { error: 'Only merchant owners can update auto-payout settings' },
        { status: 403 }
      );
    }

    const merchantId = merchantContext.merchantId;

    // Non-secret merchant fields remain granted to the authenticated Postgres
    // role, so read them on the auth-scoped client AFTER auth/permission checks,
    // keyed to the already-resolved merchant id so tenant scoping is preserved.
    const { data: merchantRecord } = await auth.supabase
      .from('merchants')
      .select('business_name, country, email, phone')
      .eq('id', merchantId)
      .single();

    if (!merchantRecord) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // The secret column `paystack_subaccount_code` is revoked from the
    // authenticated role, so a direct SELECT would fail with 42501. Read it
    // through the bounded SECURITY DEFINER RPC on the same authenticated client
    // (owner/active-staff, or a published storefront) keyed to the resolved id.
    const paystackSubaccountCode = await fetchMerchantPaystackSubaccountCode(
      auth.supabase,
      merchantId
    );

    const merchantDetails = {
      businessName: merchantRecord.business_name,
      country: merchantRecord.country,
      email: merchantRecord.email,
      paystackSubaccountCode,
      phone: merchantRecord.phone,
    };

    const result = await executePaystackSubaccountSave({
      accountName: account_name,
      accountNumber: account_number,
      authUserEmail: auth.user.email,
      autoPayoutEnabled: auto_payout_enabled,
      bankCode: bank_code,
      bankName: bank_name,
      businessName: business_name,
      merchantDetails,
      merchantId,
      shouldPersistAutoPayoutEnabled,
      supabase: auth.supabase,
    });
    if (!result.success) {
      return NextResponse.json(
        result.details
          ? { error: result.error, details: result.details }
          : { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error managing subaccount:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to save bank details',
      },
      { status: 500 }
    );
  }
}
