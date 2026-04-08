import { unstable_noStore as noStore } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  resolveImportRouteContext,
} from '@/lib/import-jobs/import-job-route-auth';
import { logger } from '@/lib/logger';
import {
  importJobParamsSchema,
  importJobRowsQuerySchema,
} from '@/schemas/import-jobs';


const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
} as const;

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

    const parsedQuery = importJobRowsQuerySchema.safeParse({
      filter: request.nextUrl.searchParams.get('filter') || undefined,
      page: request.nextUrl.searchParams.get('page') || undefined,
      pageSize: request.nextUrl.searchParams.get('pageSize') || undefined,
    });

    if (!parsedQuery.success) {
      return jsonNoStore(
        { error: 'Invalid pagination query', code: 'invalid_pagination' },
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
      return jsonNoStore({ error: 'Forbidden' }, { status: 403 });
    }

    const from = (parsedQuery.data.page - 1) * parsedQuery.data.pageSize;
    const to = from + parsedQuery.data.pageSize - 1;
    let query = authResult.context.supabase
      .from('import_job_rows')
      .select(
        'id, row_number, source_external_id, row_status, source_payload, normalized_payload, validation_errors, meta',
        { count: 'exact' }
      )
      .eq('merchant_id', authResult.context.merchantContext.merchantId)
      .eq('import_job_id', job.id);

    if (parsedQuery.data.filter === 'importable') {
      query = query.in('row_status', ['create', 'update']);
    } else if (parsedQuery.data.filter === 'needs_fix') {
      query = query.eq('row_status', 'invalid');
    }

    const {
      data: rows,
      count,
      error,
    } = await query.order('row_number', { ascending: true }).range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return jsonNoStore({
      rows: rows || [],
      pagination: {
        page: parsedQuery.data.page,
        pageSize: parsedQuery.data.pageSize,
        total: count || 0,
      },
    });
  } catch (error) {
    logger.error({
      message: 'Import job rows route failed',
      error,
    });
    return jsonNoStore(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
