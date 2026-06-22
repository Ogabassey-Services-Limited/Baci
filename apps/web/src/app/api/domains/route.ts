import { after, type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { revalidateMerchantFeed } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { triggerDomainEdgeConfigSync } from '@/lib/edge-config-sync';
import { vercel } from '@/lib/vercel';
import { createDomainSchema } from '@/schemas/domains';

const DOMAIN_COLUMNS = [
  'id',
  'domain',
  'tld',
  'domain_type',
  'status',
  'is_primary',
  'verification_token',
  'verification_token_expires_at',
  'verified_at',
  'ssl_status',
  'purchase_price',
  'renewal_price',
  'registered_at',
  'expires_at',
  'auto_renew',
  'nameservers',
  'ssl_issued_at',
  'created_at',
  'updated_at',
];

const DOMAIN_SELECT = DOMAIN_COLUMNS.join(', ');

/**
 * GET /api/domains
 * List all domains for authenticated merchant
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get all domains for this merchant (defense-in-depth, complements RLS)
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select(DOMAIN_SELECT)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });

    if (domainsError) {
      console.error('Error querying domains:', domainsError);
      return NextResponse.json(
        { error: 'Failed to fetch domains' },
        { status: 500 }
      );
    }

    return NextResponse.json({ domains });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains
 * Add a custom domain (BYOD - Bring Your Own Domain)
 */
export async function POST(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }
    const parsed = createDomainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid domain format', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { domain: rawDomain, isPrimary } = parsed.data;
    const domain = rawDomain.toLowerCase();
    const supabase = auth.supabase;

    const merchantId = await getMerchantIdForApiUser(supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Extract TLD
    let tld = `.${domain.split('.').slice(-1)[0]}`;
    if (domain.endsWith('.ng') || domain.match(/\.[a-z]+\.ng$/)) {
      const parts = domain.split('.');
      if (parts.length >= 3) {
        tld = `.${parts.slice(-2).join('.')}`;
      }
    }

    // ---------------------------------------------------------
    // VERCEL INTEGRATION
    // ---------------------------------------------------------
    let vercelResponse: Awaited<ReturnType<typeof vercel.addDomain>>;
    try {
      // Add domain to Vercel Project
      vercelResponse = await vercel.addDomain(domain);
    } catch (error: unknown) {
      console.error('Vercel Add Domain Error:', error);
      let status = 500;
      if (
        error instanceof Error &&
        'status' in error &&
        typeof (error as Record<string, unknown>).status === 'number'
      ) {
        const rawStatus = (error as Record<string, unknown>).status as number;
        if (
          Number.isFinite(rawStatus) &&
          rawStatus >= 100 &&
          rawStatus <= 599
        ) {
          status = rawStatus;
        }
      }
      const message =
        status === 409
          ? 'Domain is already in use by another account.'
          : 'Failed to add domain to Vercel.';
      return NextResponse.json({ error: message }, { status });
    }

    // Determine status based on Vercel response
    // If verification challenges exist, it is pending regardless of the 'verified' flag
    const hasChallenges =
      vercelResponse.verification && vercelResponse.verification.length > 0;
    const isVerified = vercelResponse.verified && !hasChallenges;

    const status = isVerified ? 'active' : 'pending';
    const sslStatus = isVerified ? 'active' : 'pending';

    // Find verification token if provided (e.g. for TXT record needed)
    let verificationToken = crypto.randomUUID(); // Default fallback

    if (vercelResponse.verification) {
      const txtChallenge = vercelResponse.verification.find(
        (v) => v.type === 'TXT'
      );
      if (txtChallenge) {
        verificationToken = txtChallenge.value;
      }
    }

    const verificationTokenExpiresAt = new Date(
      Date.now() + 48 * 60 * 60 * 1000
    ).toISOString();

    // Insert domain into DB
    const { data: newDomain, error: insertError } = await supabase
      .from('domains')
      .insert({
        merchant_id: merchantId,
        domain,
        tld,
        domain_type: 'custom',
        status,
        ssl_status: sslStatus,
        verification_token: verificationToken,
        verification_token_expires_at: verificationTokenExpiresAt,
        is_primary: isPrimary,
      })
      .select(DOMAIN_SELECT)
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'This domain is already registered' },
          { status: 409 }
        );
      }
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to register domain' },
        { status: 500 }
      );
    }

    // Prepare response with verification instructions
    const verificationInstructions = {
      type: 'A',
      name: '@',
      value: '76.76.21.21',
      instructions: 'Point your domain to Vercel via A Record',
    };

    // If Vercel requires a specific TXT challenge (e.g. ownership conflict), pass that
    // But mostly we prefer A-record flow.
    // However, if verification_token came from Vercel TXT, we might want to hint that.

    revalidateMerchantFeed(merchantId);
    after(() => triggerDomainEdgeConfigSync());

    return NextResponse.json({
      domain: newDomain,
      verification: verificationInstructions,
    });
  } catch (error: unknown) {
    console.error('Error adding domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
