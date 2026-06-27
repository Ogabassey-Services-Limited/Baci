import { unstable_noStore as noStore } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  type ImportRouteContext,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import { logger } from '@/lib/logger';
import { importJobParamsSchema } from '@/schemas/import-jobs';
import { receiptClaimCampaignStatsSchema } from '@/schemas/receipt-claim-rpc';

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
} as const;
const RECEIPT_CAMPAIGN_STATS_TIMEOUT_MS = 2500;

function applyNoStoreHeaders<T extends Response>(response: T) {
  Object.entries(NO_STORE_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

function jsonNoStore(
  body: Parameters<typeof NextResponse.json>[0],
  init?: Parameters<typeof NextResponse.json>[1]
) {
  return applyNoStoreHeaders(NextResponse.json(body, init));
}

async function loadReceiptCampaignStats({
  importJobId,
  merchantId,
  supabase,
}: {
  importJobId: string;
  merchantId: string;
  supabase: ImportRouteContext['supabase'];
}) {
  try {
    const { data, error } = await withTimeout(
      supabase.rpc('get_receipt_claim_campaign_stats', {
        p_import_job_id: importJobId,
        p_merchant_id: merchantId,
      }),
      RECEIPT_CAMPAIGN_STATS_TIMEOUT_MS,
      'Receipt campaign stats RPC timed out'
    );

    if (error) {
      throw new Error(
        `Failed to load receipt campaign stats: ${error.message}`
      );
    }

    const parsed = receiptClaimCampaignStatsSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error('Failed to load receipt campaign stats: invalid shape');
    }

    return parsed.data;
  } catch (error) {
    logger.error({
      message: 'Receipt campaign stats unavailable',
      importJobId,
      merchantId,
      error,
    });
    return null;
  }
}

function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs: number,
  message: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    noStore();

    const authResult = await resolveImportRouteContext(request);
    if (!authResult.context) {
      return (
        (authResult.response && applyNoStoreHeaders(authResult.response)) ??
        jsonNoStore({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    const parsedParams = importJobParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return jsonNoStore(
        { error: 'Invalid import job id', code: 'invalid_job_id' },
        { status: 400 }
      );
    }

    const job = await getImportJobForMerchant(
      authResult.context.supabase,
      authResult.context.merchantContext.merchantId,
      parsedParams.data.jobId
    );

    if (!job) {
      return jsonNoStore(
        { error: 'Import job not found', code: 'not_found' },
        { status: 404 }
      );
    }

    if (
      !hasImportRoutePermission(
        authResult.context.merchantContext,
        job.entity_type
      )
    ) {
      return jsonNoStore(
        { error: 'Forbidden', code: 'forbidden' },
        { status: 403 }
      );
    }

    const summary = (job.summary || {}) as Record<string, unknown>;
    const validRows =
      typeof summary.validRows === 'number' ? summary.validRows : 0;
    const receiptCampaign =
      job.entity_type === 'orders'
        ? await loadReceiptCampaignStats({
            importJobId: job.id,
            merchantId: authResult.context.merchantContext.merchantId,
            supabase: authResult.context.supabase,
          })
        : null;

    return jsonNoStore({
      job: {
        ...job,
        canCommit: job.status === 'preview_ready' && validRows > 0,
        canNotify:
          job.entity_type === 'orders' &&
          job.status === 'committed' &&
          validRows > 0,
        receiptCampaign,
      },
    });
  } catch (error) {
    logger.error({
      message: 'Import job detail route failed',
      error,
    });
    return jsonNoStore(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
