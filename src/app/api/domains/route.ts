import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vercel } from '@/lib/vercel';

/**
 * GET /api/domains
 * List all domains for authenticated merchant
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant ID
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get all domains for this merchant
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('*')
      .eq('merchant_id', merchant.id)
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
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { domain, isPrimary = false } = await request.json();

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }

    // Check if domain already exists in OUR database
    const { data: existingDomain } = await supabase
      .from('domains')
      .select('id')
      .eq('domain', domain)
      .single();

    if (existingDomain) {
      return NextResponse.json(
        { error: 'This domain is already registered' },
        { status: 409 }
      );
    }

    // Get merchant ID
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
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
    let vercelResponse;
    try {
      // Add domain to Vercel Project
      vercelResponse = await vercel.addDomain(domain);
    } catch (error: any) {
      console.error('Vercel Add Domain Error:', error);
      // If domain is owned by another account, Vercel might return 409
      // We should pass this error to the user
      return NextResponse.json(
        { error: error.message || 'Failed to add domain to Vercel. It might be in use by another account.' },
        { status: 409 }
      );
    }

    // Determine status based on Vercel response
    const isVerified = vercelResponse.verified;
    const status = isVerified ? 'active' : 'pending';
    const sslStatus = isVerified ? 'active' : 'pending';

    // Find verification token if provided (e.g. for TXT record needed)
    let verificationToken = crypto.randomUUID(); // Default fallback

    if (vercelResponse.verification) {
      const txtChallenge = vercelResponse.verification.find((v: any) => v.type === 'TXT');
      if (txtChallenge) {
        verificationToken = txtChallenge.value;
      }
    }

    const verificationTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

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
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({
        error: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      }, { status: 500 });
    }

    // Prepare response with verification instructions
    let verificationInstructions = {
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
      vercel: vercelResponse // Return raw Vercel response for debugging
    });

  } catch (error: any) {
    console.error('Error adding domain:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error', stack: error?.stack },
      { status: 500 }
    );
  }
}
