import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  type MerchantContext,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { IMPORT_JOB_SELECT } from '@/lib/import-jobs/import-job-columns';
import { createClient } from '@/lib/supabase/server';
import type { ImportJobEntityType } from '@/schemas/import-jobs';
import { canManageImportJob, type ImportJobRecord } from './import-job-service';

export interface ImportRouteContext {
  merchantContext: MerchantContext;
  supabase: ReturnType<typeof createClient>;
  userId: string;
}

export function hasImportRoutePermission(
  merchantContext: MerchantContext,
  entityType: ImportJobEntityType
) {
  const userAccess = toUserAccess(merchantContext);
  return canManageImportJob(entityType, (resource, action) =>
    hasPermission(userAccess, resource, action)
  );
}

export async function resolveImportRouteContext(
  _request: NextRequest,
  entityType?: ImportJobEntityType
): Promise<{ context?: ImportRouteContext; response?: NextResponse }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return {
      response: NextResponse.json(
        { error: 'Merchant access not found' },
        { status: 404 }
      ),
    };
  }

  if (entityType) {
    if (!hasImportRoutePermission(merchantContext, entityType)) {
      return {
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }
  }

  return {
    context: {
      supabase,
      userId: user.id,
      merchantContext,
    },
  };
}

export async function getImportJobForMerchant(
  supabase: ReturnType<typeof createClient>,
  merchantId: string,
  jobId: string
) {
  const { data, error } = await supabase
    .from('import_jobs')
    .select(IMPORT_JOB_SELECT)
    .eq('merchant_id', merchantId)
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load import job: ${error.message}`);
  }

  return data as ImportJobRecord | null;
}
