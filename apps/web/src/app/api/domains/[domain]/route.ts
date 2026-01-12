import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import {
  getDomainInformation,
  getDomainLock,
  getDomainNameservers,
  updateDomainLock,
  updateDomainNameservers,
} from '@/lib/go54';
import { createAdminClient } from '@/lib/supabase/admin';
import { vercel } from '@/lib/vercel';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const { user, error: authError } = await authenticateApiRequest(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Verify domain belongs to user's merchant account
    const { data: merchant } = await adminSupabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { data: domainRecord, error: domainError } = await adminSupabase
      .from('domains')
      .select('id')
      .eq('domain', domain)
      .eq('merchant_id', merchant.id)
      .single();

    if (domainError || !domainRecord) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403 }
      );
    }

    // Fetch all info in parallel
    const [info, nameservers, lock] = await Promise.all([
      getDomainInformation(domain),
      getDomainNameservers(domain),
      getDomainLock(domain),
    ]);

    return NextResponse.json({
      info,
      nameservers,
      lock,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch domain details';
    console.error('Error fetching domain details:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const body = await request.json();
    const { action, data } = body;

    const { user, error: authError } = await authenticateApiRequest(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Verify domain belongs to user's merchant account
    const { data: merchant } = await adminSupabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { data: domainRecord, error: domainError } = await adminSupabase
      .from('domains')
      .select('id')
      .eq('domain', domain)
      .eq('merchant_id', merchant.id)
      .single();

    if (domainError || !domainRecord) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403 }
      );
    }

    let result: unknown;

    switch (action) {
      case 'update_nameservers':
        result = await updateDomainNameservers(domain, data);
        break;
      case 'update_lock':
        result = await updateDomainLock(domain, data.lock);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update domain';
    console.error('Error updating domain:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const { user, error: authError } = await authenticateApiRequest(request);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    const { data: merchant } = await adminSupabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await adminSupabase
      .from('domains')
      .delete()
      .eq('domain', domain)
      .eq('merchant_id', merchant.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete domain' },
        { status: 500 }
      );
    }

    // Try to remove from Vercel as well (best effort)
    try {
      await vercel.removeDomain(domain);
    } catch (vercelError) {
      console.warn('Failed to remove domain from Vercel:', vercelError);
      // We do not fail the request because DB deletion succeeded
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
