import { type NextRequest, NextResponse } from 'next/server';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { lookupRepairStatus } from '@/lib/repairs/status-lookup';
import { createAnonClient } from '@/lib/supabase/anon';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';
import { repairStatusLookupSchema } from '@/schemas/repair-status-lookup';

// Public, unauthenticated repair status lookup. Enumeration guard: the response
// is identical whether the ticket does not exist or the email does not match
// (the match happens inside the SECURITY DEFINER RPC). Rate limited to blunt
// brute-force of the ticket + email space.

async function resolveMerchantId(slug: string): Promise<string | null> {
  if (!isValidMerchantIdentifier(slug)) {
    return null;
  }
  const key = slug.toLowerCase();
  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(key)
    : await getCachedMerchant(key);
  return merchant?.id ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const allowed = await ensureActionRateLimit('repair-status-lookup', {
    requests: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many lookups. Please try again shortly.' },
      { status: 429 }
    );
  }

  const { slug } = await params;
  const merchantId = await resolveMerchantId(slug);
  if (!merchantId) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = repairStatusLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const supabase = createAnonClient();
  const outcome = await lookupRepairStatus(
    supabase,
    merchantId,
    parsed.data.ticketNumber,
    parsed.data.email
  );

  // Same generic shape whether not-found or email-mismatch — no enumeration.
  if (!outcome.found) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({ found: true, repair: outcome.result });
}
