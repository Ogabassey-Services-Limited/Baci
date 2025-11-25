import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getDomainEmailForwarding, updateDomainEmailForwarding } from '@/lib/go54';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logAudit } from '@/lib/audit-logger';

/**
 * GET /api/domains/[domain]/email-forwarding
 * Get email forwarding configuration
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

        // Rate Limiting
        const isAllowed = await checkRateLimit(supabase, user.id, 'email_forwarding_read', 100, 1);
        if (!isAllowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
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
        const forwarding = await getDomainEmailForwarding(domain);

        return NextResponse.json(forwarding);
    } catch (error) {
        console.error('Error fetching email forwarding:', error);
        return NextResponse.json(
            { error: 'Failed to fetch email forwarding' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/domains/[domain]/email-forwarding
 * Update email forwarding configuration
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { domain: string } }
) {
    let user = null;
    let domainData = null;
    const domain = params.domain;
    let cookieStore;
    let supabase;

    try {
        cookieStore = await cookies();
        supabase = createClient(cookieStore);
        const authResult = await supabase.auth.getUser();
        user = authResult.data.user;

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate Limiting
        const isAllowed = await checkRateLimit(supabase, user.id, 'email_forwarding_update', 10, 1);
        if (!isAllowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

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
            if (!forward.forwardto || !emailRegex.test(forward.forwardto)) {
                return NextResponse.json(
                    { error: `Invalid destination email: ${forward.forwardto}` },
                    { status: 400 }
                );
            }
            if (!forward.prefix) {
                return NextResponse.json(
                    { error: 'Email prefix is required' },
                    { status: 400 }
                );
            }
        }

        // Verify the user owns this domain
        const { data: dData, error: domainError } = await supabase
            .from('domains')
            .select('*')
            .eq('domain', domain)
            .eq('merchant_id', user.id)
            .single();

        domainData = dData;

        if (domainError || !domainData) {
            return NextResponse.json(
                { error: 'Domain not found or access denied' },
                { status: 404 }
            );
        }

        // Get current config for audit log
        let currentConfig = [];
        try {
            currentConfig = await getDomainEmailForwarding(domain);
        } catch (e) {
            console.warn('Failed to fetch current forwarding config', e);
        }

        // Update email forwarding via Go54
        const result = await updateDomainEmailForwarding(domain, forwards);

        // Log success
        await logAudit(supabase, {
            user_id: user.id,
            merchant_id: domainData.merchant_id,
            action: 'email_forwarding.update',
            resource_type: 'email_forwarding',
            resource_id: domain,
            changes: {
                before: { forwards: currentConfig },
                after: { forwards: forwards }
            },
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
            status: 'success'
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error updating email forwarding:', error);

        // Log failure
        if (user && supabase) {
            await logAudit(supabase, {
                user_id: user.id,
                merchant_id: domainData?.merchant_id,
                action: 'email_forwarding.update',
                resource_type: 'email_forwarding',
                resource_id: domain,
                status: 'failure',
                error_message: errorMessage
            });
        }

        return NextResponse.json(
            { error: 'Failed to update email forwarding' },
            { status: 500 }
        );
    }
}
