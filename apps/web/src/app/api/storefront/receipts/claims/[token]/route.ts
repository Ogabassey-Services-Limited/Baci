import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';
import { loadReceiptClaimPreview } from '@/lib/import-notifications/receipt-claim-preview';
import { createClient } from '@/lib/supabase/server';
import { receiptClaimRouteParamsSchema } from '@/schemas/receipt-claim-route-params';
import { redeemReceiptClaimResultSchema } from '@/schemas/receipt-claim-rpc';

interface RouteContext {
  params: Promise<{ token: string }>;
}

async function parseToken(context: RouteContext) {
  const params = await context.params;
  const parsed = receiptClaimRouteParamsSchema.safeParse(params);

  if (!parsed.success) {
    return null;
  }

  return parsed.data.token;
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
    const preview = await loadReceiptClaimPreview({ supabase, token });

    if (!preview.ok) {
      return NextResponse.json(
        { error: preview.error },
        { status: preview.status }
      );
    }

    return NextResponse.json({ claim: preview.claim });
  } catch (error) {
    console.error('Failed to load receipt claim', error);
    return NextResponse.json(
      { error: 'Failed to load receipt claim' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  const token = await parseToken(context);
  if (!token) {
    return NextResponse.json(
      { error: 'Invalid receipt claim link' },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await auth.supabase.rpc('redeem_receipt_claim', {
      p_token_hash: hashReceiptClaimToken(token),
    });

    if (error) {
      throw new Error(`Failed to redeem receipt claim: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Receipt claim link not found' },
        { status: 404 }
      );
    }

    const parsedResult = redeemReceiptClaimResultSchema.safeParse(data);
    if (!parsedResult.success) {
      throw new Error(
        'Failed to redeem receipt claim: invalid response structure'
      );
    }

    const result = parsedResult.data;

    if (result.status === 'not_found') {
      return NextResponse.json(
        { error: 'Receipt claim link not found' },
        { status: 404 }
      );
    }

    if (result.status === 'expired') {
      return NextResponse.json(
        { error: 'Receipt claim link has expired' },
        { status: 410 }
      );
    }

    if (result.status === 'email_mismatch') {
      return NextResponse.json(
        {
          error:
            'Sign in with the email address that received this receipt link',
        },
        { status: 403 }
      );
    }

    if (result.status === 'already_used') {
      return NextResponse.json(
        { error: 'Receipt claim link has already been used' },
        { status: 409 }
      );
    }

    if (result.status === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (result.status !== 'ok') {
      throw new Error(
        `Failed to redeem receipt claim: ${result.status || 'unknown_status'}`
      );
    }

    return NextResponse.json({
      redirectPath: result.redirectPath || '/receipts',
      success: true,
    });
  } catch (error) {
    console.error('Failed to redeem receipt claim', error);
    return NextResponse.json(
      { error: 'Failed to redeem receipt claim' },
      { status: 500 }
    );
  }
}
