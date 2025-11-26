import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { resolveTxt } from 'dns/promises';

/**
 * POST /api/domains/[domain]/verify
 * Verify domain ownership by checking DNS TXT record
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
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
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Get domain record
    const { data: domainRecord, error: domainError } = await supabase
      .from('domains')
      .select('*')
      .eq('domain', domain)
      .eq('merchant_id', merchant.id)
      .single();

    if (domainError || !domainRecord) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    if (!domainRecord.verification_token) {
      return NextResponse.json(
        { error: 'No verification token found for this domain' },
        { status: 400 }
      );
    }

    // Check DNS TXT record
    try {
      const txtRecords = await resolveTxt(`_baci-verification.${domain}`);
      const flatRecords = txtRecords.flat();

      // Check if verification token exists in TXT records
      const isVerified = flatRecords.some(
        (record) => record === domainRecord.verification_token
      );

      if (isVerified) {
        // Update domain status to active
        const { error: updateError } = await supabase
          .from('domains')
          .update({
            status: 'active',
            verified_at: new Date().toISOString(),
            ssl_status: 'pending', // SSL will be provisioned separately
          })
          .eq('id', domainRecord.id);

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to update domain status' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Domain verified successfully',
          domain: {
            ...domainRecord,
            status: 'active',
            verified_at: new Date().toISOString(),
          },
        });
      } else {
        // TXT record exists but doesn't match
        return NextResponse.json(
          {
            success: false,
            error:
              'Verification failed: TXT record found but token does not match',
          },
          { status: 400 }
        );
      }
    } catch (dnsError: unknown) {
      // DNS lookup failed - record doesn't exist
      const errorCode = (dnsError as { code?: string }).code;
      const errorMessage = dnsError instanceof Error ? dnsError.message : 'Unknown error';

      if (errorCode === 'ENOTFOUND' || errorCode === 'ENODATA') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Verification failed: TXT record not found. Please ensure you have added the DNS record and wait for propagation (can take up to 48 hours).',
          },
          { status: 400 }
        );
      }

      // Other DNS errors
      console.error('DNS verification error:', dnsError);
      return NextResponse.json(
        {
          success: false,
          error: `DNS lookup failed: ${errorMessage}`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error verifying domain:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
