import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getDomainEmailForwarding, updateDomainEmailForwarding } from '@/lib/go54';

/**
 * GET /api/domains/[domain]/email-forwarding
 * Get email forwarding configuration for a domain
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { domain: string } }
) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const domain = params.domain;

        // Verify the user owns this domain
        const { data: domainData, error: domainError } = await supabase
            .from('domains')
            .select('*')
            .eq('domain', domain)
            .eq('merchant_id', user.id)
            .single();

        if (domainError || !domainData) {
            return NextResponse.json(
                { error: 'Domain not found or access denied' },
                { status: 404 }
            );
        }

        // Get email forwarding from Go54
        const emailForwarding = await getDomainEmailForwarding(domain);

        return NextResponse.json(emailForwarding);
    } catch (error) {
        console.error('Error fetching email forwarding:', error);
        return NextResponse.json(
            { error: 'Failed to fetch email forwarding configuration' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/domains/[domain]/email-forwarding
 * Update email forwarding configuration for a domain
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { domain: string } }
) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const domain = params.domain;
        const body = await request.json();
        const { forwards } = body;

        if (!forwards || !Array.isArray(forwards)) {
            return NextResponse.json(
                { error: 'Invalid request: forwards array is required' },
                { status: 400 }
            );
        }

        // Validate email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        for (const forward of forwards) {
            if (!forward.prefix || !forward.forwardto) {
                return NextResponse.json(
                    { error: 'Each forward must have prefix and forwardto fields' },
                    { status: 400 }
                );
            }
            if (!emailRegex.test(forward.forwardto)) {
                return NextResponse.json(
                    { error: `Invalid email address: ${forward.forwardto}` },
                    { status: 400 }
                );
            }
        }

        // Verify the user owns this domain
        const { data: domainData, error: domainError } = await supabase
            .from('domains')
            .select('*')
            .eq('domain', domain)
            .eq('merchant_id', user.id)
            .single();

        if (domainError || !domainData) {
            return NextResponse.json(
                { error: 'Domain not found or access denied' },
                { status: 404 }
            );
        }

        // Update email forwarding via Go54
        const result = await updateDomainEmailForwarding(domain, forwards);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error updating email forwarding:', error);
        return NextResponse.json(
            { error: 'Failed to update email forwarding configuration' },
            { status: 500 }
        );
    }
}
