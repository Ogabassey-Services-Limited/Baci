import { type NextRequest, NextResponse } from 'next/server';
import {
  getAdminMerchantHealthRows,
  sortAdminMerchantHealthRows,
} from '@/lib/admin-merchant-health';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { adminMerchantsQuerySchema } from '@/schemas/admin-merchants-query';
import type {
  AdminMerchantHealthRow,
  AdminMerchantsResponse,
} from '@/types/admin-merchants';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (merchantContext.staffAccess.isStaff) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('merchants')
      .select('is_platform_admin')
      .eq('id', merchantContext.merchantId)
      .maybeSingle();

    if (adminCheckError) {
      console.error('Admin merchants admin check error:', adminCheckError);
      return NextResponse.json(
        { error: 'Failed to verify admin access' },
        { status: 500 }
      );
    }

    if (!adminCheck?.is_platform_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parseResult = adminMerchantsQuerySchema.safeParse({
      sortBy: searchParams.get('sortBy') ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error:
            parseResult.error.issues[0]?.message ?? 'Invalid sort parameter',
          code: 'INVALID_SORT',
        },
        { status: 400 }
      );
    }

    const { data, error } = await getAdminMerchantHealthRows(supabase);

    if (error) {
      console.error('Admin merchants RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch merchant data' },
        { status: 500 }
      );
    }

    const response: AdminMerchantsResponse = {
      data: sortAdminMerchantHealthRows(
        (data as AdminMerchantHealthRow[] | null) ?? [],
        parseResult.data.sortBy
      ),
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Admin merchants route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merchant data' },
      { status: 500 }
    );
  }
}
