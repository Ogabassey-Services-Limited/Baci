import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * GET /api/domains
 * List all domains for authenticated merchant
 */
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
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
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Get all domains for this merchant
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    if (domainsError) {
      return NextResponse.json({ error: domainsError.message }, { status: 500 });
    }

    return NextResponse.json({ domains });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/domains
 * Add a custom domain (BYOD - Bring Your Own Domain)
 */
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { domain, isPrimary = false } = await request.json();

    // Validate domain format
    const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Check if domain already exists
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
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Extract TLD from domain
    let tld = '.' + domain.split('.').slice(-1)[0];
    if (domain.includes('.ng')) {
      const parts = domain.split('.');
      if (parts.length >= 3) {
        tld = '.' + parts.slice(-2).join('.');
      }
    }

    // Generate verification token for domain ownership verification
    const verificationToken = crypto.randomUUID();

    // Insert domain
    const { data: newDomain, error: insertError } = await supabase
      .from('domains')
      .insert({
        merchant_id: merchant.id,
        domain,
        tld,
        domain_type: 'custom',
        status: 'pending',
        verification_token: verificationToken,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      domain: newDomain,
      verification: {
        type: 'TXT',
        name: '_baci-verification',
        value: verificationToken,
        instructions:
          'Add this TXT record to your DNS to verify domain ownership',
      },
    });
  } catch (error) {
    console.error('Error adding domain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
