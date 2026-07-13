import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret, getPetrockConfig } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { PETROCK_LOW_BALANCE_USD } from '@/lib/imei-providers/petrock/petrock.constants';
import { normalizePetrockCatalog } from '@/lib/imei-providers/petrock/petrock-catalog';
import { createPetrockClient } from '@/lib/imei-providers/petrock/petrock-client';
import { buildPetrockRemediationCatalogRows } from '@/lib/imei-remediation/petrock-remediation-catalog';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest | Request) {
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getPetrockConfig();
  if (!config) {
    return NextResponse.json({
      skipped: 'petrock_not_configured',
      success: true,
    });
  }

  const client = createPetrockClient(config);
  const [productsResult, accountResult] = await Promise.all([
    client.getProducts(),
    client.getAccount(),
  ]);
  if (!productsResult.ok) {
    console.error('[Petrock Catalog] Product sync request failed', {
      kind: productsResult.kind,
      status: productsResult.status,
    });
    return NextResponse.json(
      { code: 'PETROCK_CATALOG_UNAVAILABLE', error: 'Catalog sync failed' },
      { status: 502 }
    );
  }

  let rows: ReturnType<typeof normalizePetrockCatalog>;
  try {
    rows = normalizePetrockCatalog(productsResult.data, new Date());
  } catch (error) {
    console.error('[Petrock Catalog] Product normalization failed', { error });
    return NextResponse.json(
      { code: 'PETROCK_CATALOG_INVALID', error: 'Catalog sync failed' },
      { status: 502 }
    );
  }

  if (rows.length === 0) {
    console.error('[Petrock Catalog] Upstream returned no IMEI products');
    return NextResponse.json(
      { code: 'PETROCK_CATALOG_EMPTY', error: 'Catalog sync failed' },
      { status: 502 }
    );
  }

  const supabase = createAdminClient();
  const { error: catalogSyncError } = await supabase.rpc(
    'sync_petrock_imei_provider_products',
    { p_rows: rows }
  );
  if (catalogSyncError) {
    console.error('[Petrock Catalog] Failed to store snapshot', {
      error: catalogSyncError,
    });
    return NextResponse.json(
      { code: 'PETROCK_CATALOG_SAVE_FAILED', error: 'Catalog sync failed' },
      { status: 500 }
    );
  }

  const { error: remediationSyncError } = await supabase.rpc(
    'sync_petrock_remediation_products',
    { p_rows: buildPetrockRemediationCatalogRows(rows) }
  );
  if (remediationSyncError) {
    console.error('[Petrock Catalog] Failed to sync remediation curation', {
      error: remediationSyncError,
    });
    return NextResponse.json(
      {
        code: 'PETROCK_REMEDIATION_SYNC_FAILED',
        error: 'Catalog sync failed',
      },
      { status: 500 }
    );
  }

  const account = accountResult.ok
    ? {
        balance: accountResult.data.balance,
        currency: accountResult.data.currency,
        lowBalance: accountResult.data.balance < PETROCK_LOW_BALANCE_USD,
      }
    : { unavailable: true };
  if ('lowBalance' in account && account.lowBalance) {
    console.warn('[Petrock Catalog] Reseller balance is below threshold', {
      balance: account.balance,
      currency: account.currency,
    });
  }

  return NextResponse.json({
    account,
    productCount: rows.length,
    remediationCandidateCount: rows.length,
    success: true,
  });
}
