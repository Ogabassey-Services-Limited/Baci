import { NextResponse } from 'next/server';
import {
  getMerchantWalletAccount,
  requestMerchantWalletAccount,
} from '@/lib/merchant-wallet-payment-accounts';
import { createClient } from '@/lib/supabase/server';
import { merchantWalletFundingConsentSchema } from '@/schemas/merchant-wallet-funding';

async function ownerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('id, business_name, email')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error)
    return {
      response: NextResponse.json(
        { error: 'Unable to load merchant' },
        { status: 500 }
      ),
    } as const;
  if (!merchant)
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    } as const;
  return { supabase, user, merchant } as const;
}

export async function GET() {
  const context = await ownerContext();
  if ('response' in context) return context.response;
  try {
    return NextResponse.json({
      account: await getMerchantWalletAccount(
        context.supabase,
        context.merchant.id
      ),
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to load funding account' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const context = await ownerContext();
  if ('response' in context) return context.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = merchantWalletFundingConsentSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Consent is required' }, { status: 400 });
  try {
    const result = await requestMerchantWalletAccount(context.supabase, {
      id: context.merchant.id,
      email: context.merchant.email ?? context.user.email ?? '',
      firstName: context.merchant.business_name,
    });
    return NextResponse.json(
      { account: result.account, status: result.status },
      { status: result.status === 'pending' ? 202 : 200 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Unable to start funding account assignment' },
      { status: 502 }
    );
  }
}
