import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const merchantContext = await getMerchantForApiRequest(
    auth.supabase,
    auth.user.id
  );
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'dashboard', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const health = await loadAgenticActionHealth(
      auth.supabase,
      merchantContext.merchantId,
      {
        onRequestControlError: (error) => {
          logger.warn({
            error: sanitizeForLog(error),
            merchantId: merchantContext.merchantId,
            message:
              'Failed to load agentic request controls for action health',
          });
        },
      }
    );

    return NextResponse.json({
      ...health,
      merchant_id: merchantContext.merchantId,
    });
  } catch (error) {
    logger.error({
      message: 'Failed to load agentic action health',
      error: sanitizeForLog(error),
      merchantId: merchantContext.merchantId,
    });
    return NextResponse.json(
      { error: 'Failed to load agentic action health' },
      { status: 500 }
    );
  }
}
