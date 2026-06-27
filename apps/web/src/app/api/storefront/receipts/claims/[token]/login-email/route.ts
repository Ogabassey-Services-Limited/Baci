import { type NextRequest, NextResponse } from 'next/server';
import {
  loadReceiptClaimLoginEmailHint,
  parseReceiptClaimToken,
} from '@/lib/import-notifications/receipt-claim-preview';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ token: string }>;
}

async function parseToken(context: RouteContext) {
  const params = await context.params;
  return parseReceiptClaimToken(params.token);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const token = await parseToken(context);
  if (!token) {
    return NextResponse.json(
      { error: 'Invalid receipt claim link' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const hint = await loadReceiptClaimLoginEmailHint({ supabase, token });

    if (!hint.ok) {
      return NextResponse.json({ error: hint.error }, { status: hint.status });
    }

    return NextResponse.json({ emailHint: hint.emailHint });
  } catch (error) {
    console.error('Failed to load receipt claim login email', error);
    return NextResponse.json(
      { error: 'Failed to load receipt claim login email' },
      { status: 500 }
    );
  }
}
