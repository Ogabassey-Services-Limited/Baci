import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { listSavedPaymentMethods } from '@/lib/customer-saved-payment-methods';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVtuCustomer } from '@/lib/vtu-pending-transaction';
import { vtuSavedPaymentMethodsQuerySchema } from '@/schemas/vtu';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = vtuSavedPaymentMethodsQuerySchema.safeParse({
      merchantSlug: searchParams.get('merchantSlug'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', parsed.data.merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const customer = await resolveVtuCustomer({
      supabase,
      merchantId: merchant.id,
      user: auth.user,
    });

    if (!customer) {
      return NextResponse.json({ cards: [] });
    }

    const cards = await listSavedPaymentMethods({
      supabase,
      merchantId: merchant.id,
      customerId: customer.id,
    });

    return NextResponse.json({ cards });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch saved cards',
      },
      { status: 500 }
    );
  }
}
