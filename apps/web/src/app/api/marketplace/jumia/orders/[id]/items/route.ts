import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { JumiaClient } from '@/lib/jumia/client';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> } // Params are now Promises in Next.js 15+, handling compatible way
) {
  try {
    const { id } = await params;

    // Auth Check
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant)
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 403 }
      );

    const jumiaClient = await JumiaClient.forMerchant(merchant.id);
    if (!jumiaClient) {
      return NextResponse.json(
        { error: 'Jumia integration not found' },
        { status: 404 }
      );
    }

    const items = await jumiaClient.getOrderItems(id);

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch items';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
