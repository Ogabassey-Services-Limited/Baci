import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { resolveAccountNumber } from '@/lib/paystack';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { accountNumber, bankCode } = await request.json();

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { error: 'Account number and bank code are required' },
        { status: 400 }
      );
    }

    // Auth Check (Support both Cookie and Bearer Token)
    const authHeader = request.headers.get('Authorization');
    let user;

    if (authHeader) {
      const { createClient: createSupabaseClient } = await import(
        '@supabase/supabase-js'
      );
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } else {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call Paystack
    const result = await resolveAccountNumber(accountNumber, bankCode);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Could not resolve account' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      account_name: result.data.account_name,
      account_number: result.data.account_number,
      bank_id: result.data.bank_id,
    });
  } catch (error) {
    console.error('Resolve Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during resolution' },
      { status: 500 }
    );
  }
}
