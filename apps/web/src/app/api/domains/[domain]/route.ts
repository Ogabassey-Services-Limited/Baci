import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import {
  getDomainInformation,
  getDomainLock,
  getDomainNameservers,
  updateDomainLock,
  updateDomainNameservers,
} from '@/lib/go54';
import { vercel } from '@/lib/vercel';

const nameserverDataSchema = z.object({
  nameserver1: z.string(),
  nameserver2: z.string(),
  nameserver3: z.string().optional(),
  nameserver4: z.string().optional(),
  nameserver5: z.string().optional(),
});

const lockDataSchema = z.object({
  lock: z.boolean(),
});

const domainActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_nameservers'),
    data: nameserverDataSchema,
  }),
  z.object({ action: z.literal('update_lock'), data: lockDataSchema }),
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const auth = await authenticateApiRequest(request);

    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = auth.supabase;
    const merchantId = await getMerchantIdForApiUser(supabase);

    // Verify domain belongs to user's merchant account
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { data: domainRecord, error: domainError } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', domain)
      .eq('merchant_id', merchantId)
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
    const auth = await authenticateApiRequest(request);

    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = auth.supabase;
    const merchantId = await getMerchantIdForApiUser(supabase);

    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = domainActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid action', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const actionData = parsed.data;

    // Verify domain belongs to user's merchant account
    const { data: domainRecord, error: domainError } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', domain)
      .eq('merchant_id', merchantId)
      .single();

    if (domainError || !domainRecord) {
      return NextResponse.json(
        { error: 'Domain not found or access denied' },
        { status: 403 }
      );
    }

    let result: unknown;

    switch (actionData.action) {
      case 'update_nameservers':
        result = await updateDomainNameservers(domain, actionData.data);
        break;
      case 'update_lock':
        result = await updateDomainLock(domain, actionData.data.lock);
        break;
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
    const auth = await authenticateApiRequest(request);

    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = auth.supabase;
    const merchantId = await getMerchantIdForApiUser(supabase);

    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from('domains')
      .delete()
      .eq('domain', domain)
      .eq('merchant_id', merchantId);

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
