import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { vercel } from '@/lib/vercel';

const domainRegex = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;

const createDomainSchema = z.object({
  domain: z
    .string()
    .min(1)
    .refine((value) => domainRegex.test(value), {
      message: 'Invalid domain format',
    }),
  isPrimary: z.boolean().optional().default(false),
});

const DOMAIN_SELECT =
  'id, domain, tld, domain_type, status, is_primary, verification_token, verification_token_expires_at, verified_at, ssl_status, purchase_price, renewal_price, registered_at, expires_at, auto_renew, nameservers, ssl_issued_at, created_at, updated_at';

/**
 * GET /api/domains
 * List all domains for authenticated merchant
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = auth.supabase;

    // Get all domains for this merchant
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select(DOMAIN_SELECT)
      .order('created_at', { ascending: false });

    if (domainsError) {
      return NextResponse.json(
        { error: domainsError.message },
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
export async function POST(request: Request) {
  try {
    const { valid, response } = await checkCsrfProtection(
      request as NextRequest
    );
    if (!valid && response) return response;

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
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

    // Get merchant ID
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', auth.user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Extract TLD
    let tld = `.${domain.split('.').slice(-1)[0]}`;
    if (domain.includes('.ng')) {
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
      // If domain is owned by another account, Vercel might return 409
      // We should pass this error to the user
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          error:
            errorMessage ||
            'Failed to add domain to Vercel. It might be in use by another account.',
        },
        { status: 409 }
      );
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
        merchant_id: merchant.id,
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
        {
          error: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        },
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

    return NextResponse.json({
      domain: newDomain,
      verification: verificationInstructions,
      vercel: vercelResponse, // Return raw Vercel response for debugging
    });
  } catch (error: unknown) {
    console.error('Error adding domain:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
