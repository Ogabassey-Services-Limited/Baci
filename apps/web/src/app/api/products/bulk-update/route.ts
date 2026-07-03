import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import { revalidateProducts } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { getCurrencyConfig } from '@/lib/currency';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { BulkUpdateChangesSchema } from '@/schemas/dashboard-product-import-actions';
import { processBulkUpdateChanges } from './bulk-update-change-processing';

export async function POST(request: NextRequest) {
  const { valid, response } = await checkCsrfProtection(request);
  if (!valid && response) return response;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'products', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const merchantId = merchantContext.merchantId;
    const { data: merchantDetails, error: merchantError } = await supabase
      .from('merchants')
      .select('business_name, country, payout_currency')
      .eq('id', merchantId)
      .maybeSingle();

    if (merchantError) {
      return NextResponse.json(
        { error: 'Failed to fetch merchant details' },
        { status: 500 }
      );
    }

    const merchantBusinessName =
      merchantDetails?.business_name ?? merchantContext.businessName ?? '';
    const currency = getCurrencyConfig(
      merchantDetails?.country ?? null,
      merchantDetails?.payout_currency ?? null
    ).code;

    const body = await request.json();
    const parseResult = BulkUpdateChangesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid changes data',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const results = await processBulkUpdateChanges({
      changes: parseResult.data.changes,
      currency,
      merchantBusinessName,
      merchantId,
      supabase,
    });

    revalidateProducts(merchantId);

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
