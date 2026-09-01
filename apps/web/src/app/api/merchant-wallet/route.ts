import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: 'Unable to load merchant' },
      { status: 500 }
    );
  if (!merchant)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data: wallet, error: walletError } = await supabase.rpc(
    'get_wallet_summary',
    { p_merchant_id: merchant.id }
  );
  if (walletError)
    return NextResponse.json(
      { error: 'Unable to load wallet' },
      { status: 500 }
    );
  const row = Array.isArray(wallet) ? wallet[0] : wallet;
  return NextResponse.json({
    availableBalance: Number(row?.available_balance ?? 0),
    currency: 'NGN',
  });
}
