import {
  MERCHANT_SETTINGS_COLUMNS,
  normalizeCacSearchTerm,
} from '@baci/shared';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import {
  type CacPublicRecordsError,
  fetchCacCompanies,
  fetchCacTaxId,
  findMatchingCacCompany,
} from '@/lib/cac-public-records';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';
import { taxIdVerifySchema } from '@/schemas/verification';

const MERCHANT_TAX_IDENTITY_COLUMNS =
  'id, business_name, legal_entity_name, cac_rc_number';

interface MerchantTaxIdentity {
  id: string;
  business_name: string | null;
  legal_entity_name: string | null;
  cac_rc_number: string | null;
}

function isCacPublicRecordsError(
  error: unknown
): error is CacPublicRecordsError {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

function valueOrUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error ?? 'Unauthorized' },
      { status: 401 }
    );
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const access = await getUserAccess(auth.supabase);
  if (!access) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!hasPermission(access, 'settings', 'edit')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allowed = await checkRateLimit(
    auth.supabase,
    auth.user.id,
    'verify-tax-id',
    10,
    1
  );
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'rate_limited' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parsed = taxIdVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: merchant, error: merchantError } = await auth.supabase
    .from('merchants')
    .select(MERCHANT_TAX_IDENTITY_COLUMNS)
    .eq('id', access.merchantId)
    .single();

  if (merchantError || !merchant) {
    console.error('Merchant tax identity lookup failed:', merchantError);
    return NextResponse.json(
      { error: 'Failed to load merchant tax identity' },
      { status: 500 }
    );
  }

  const merchantTaxIdentity = merchant as MerchantTaxIdentity;
  const legalEntityName =
    valueOrUndefined(parsed.data.legalEntityName) ??
    valueOrUndefined(merchantTaxIdentity.legal_entity_name) ??
    valueOrUndefined(merchantTaxIdentity.business_name);
  const rcNumber = valueOrUndefined(merchantTaxIdentity.cac_rc_number);
  const searchTerm = rcNumber
    ? normalizeCacSearchTerm(rcNumber)
    : legalEntityName;

  if (!searchTerm || (!legalEntityName && !rcNumber)) {
    return NextResponse.json(
      {
        error:
          'Registered business name is required before verifying this Tax ID.',
        code: 'missing_business_identity',
      },
      { status: 400 }
    );
  }

  try {
    const companies = await fetchCacCompanies(searchTerm);
    const matchingCompany = findMatchingCacCompany(companies, {
      legalEntityName,
      rcNumber,
    });

    if (!matchingCompany) {
      return NextResponse.json(
        {
          error: 'CAC record not found for this business.',
          code: 'cac_record_not_found',
        },
        { status: 404 }
      );
    }

    const cacTaxId = await fetchCacTaxId(matchingCompany);
    if (!cacTaxId) {
      return NextResponse.json(
        {
          error: 'CAC did not return a Tax ID for this business.',
          code: 'cac_tax_id_missing',
        },
        { status: 404 }
      );
    }

    if (cacTaxId !== parsed.data.taxIdentificationNumber) {
      return NextResponse.json(
        {
          error:
            'Tax ID is invalid or does not match the CAC record for this business.',
          code: 'tax_id_mismatch',
        },
        { status: 422 }
      );
    }

    const { data: updatedMerchant, error: updateError } = await auth.supabase
      .from('merchants')
      .update({
        tax_identification_number: parsed.data.taxIdentificationNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', access.merchantId)
      .select(MERCHANT_SETTINGS_COLUMNS)
      .single();

    if (updateError || !updatedMerchant) {
      console.error('Merchant tax id update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to save verified Tax ID' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      verified: true,
      taxIdentificationNumber: parsed.data.taxIdentificationNumber,
      merchant: updatedMerchant,
    });
  } catch (error) {
    if (isCacPublicRecordsError(error)) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Tax ID CAC verification failed:', error);
    return NextResponse.json(
      { error: 'Tax ID verification failed' },
      { status: 500 }
    );
  }
}
