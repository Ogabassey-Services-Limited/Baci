import { type NextRequest, NextResponse } from 'next/server';
import { getAdminMerchantUserDirectory } from '@/lib/admin-merchant-users';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import { adminMerchantRouteParamsSchema } from '@/schemas/admin-merchant-route-params';

type RouteContext = {
  params: Promise<{
    merchantId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parseResult = adminMerchantRouteParamsSchema.safeParse(
      await context.params
    );
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.issues[0]?.message ?? 'Invalid merchant ID',
          code: 'INVALID_MERCHANT_ID',
        },
        { status: 400 }
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'User not associated with a merchant' },
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
      console.error('Admin merchant users admin check error:', adminCheckError);
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

    const { data, error } = await getAdminMerchantUserDirectory(
      supabase,
      parseResult.data.merchantId
    );

    if (error) {
      console.error('Admin merchant users query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch merchant users' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    console.info('Admin merchant users directory read:', {
      generatedAt: data.generatedAt,
      totalUsers:
        data.users.staff.length +
        data.users.customers.length +
        data.users.unmatchedAppUsers.length +
        1,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin merchant users route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merchant users' },
      { status: 500 }
    );
  }
}
