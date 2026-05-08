import { type NextRequest, NextResponse } from 'next/server';
import { parseRequestedMerchantId } from '@/app/api/branches/branch-route-utils';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { getMerchantAnalyticsOverview } from '@/lib/get-merchant-analytics-overview';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { analyticsQuerySchema } from '@/schemas/analytics-query';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const parsedQuery = analyticsQuerySchema.safeParse({
      branchId: searchParams.get('branchId') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          code: 'INVALID_QUERY',
          error:
            parsedQuery.error.issues[0]?.message ?? 'Invalid analytics query',
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const startDate = parsedQuery.data.startDate
      ? new Date(parsedQuery.data.startDate)
      : new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const endDate = parsedQuery.data.endDate
      ? new Date(parsedQuery.data.endDate)
      : now;

    if (startDate.getTime() > endDate.getTime()) {
      return NextResponse.json(
        {
          code: 'INVALID_DATE_RANGE',
          error: 'startDate must be on or before endDate',
        },
        { status: 400 }
      );
    }

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: requestedMerchant.merchantId }
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'analytics', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const branchId = parsedQuery.data.branchId;
    if (branchId) {
      const { data: branch, error: branchError } = await auth.supabase
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('merchant_id', merchantContext.merchantId)
        .eq('active', true)
        .maybeSingle();

      if (branchError) {
        console.error('Analytics branch validation failed:', branchError);
        return NextResponse.json(
          {
            code: 'BRANCH_VALIDATION_FAILED',
            error: 'Failed to validate branch',
          },
          { status: 500 }
        );
      }

      if (!branch) {
        return NextResponse.json(
          { code: 'BRANCH_NOT_FOUND', error: 'Branch not found' },
          { status: 404 }
        );
      }
    }

    const analytics = await getMerchantAnalyticsOverview(
      auth.supabase,
      merchantContext.merchantId,
      startDate,
      endDate,
      branchId
    );

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
