import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getDomainIDProtection, updateDomainIDProtection } from '@/lib/go54';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logAudit } from '@/lib/audit-logger';

/**
 * GET /api/domains/[domain]/id-protection
 * Get ID protection status
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
        const isAllowed = await checkRateLimit(supabase, user.id, 'id_protection_read', 100, 1);
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

        // Get ID protection status from Go54
        const status = await getDomainIDProtection(domain);

        return NextResponse.json(status);
    } catch (error) {
        console.error('Error fetching ID protection status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch ID protection status' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/domains/[domain]/id-protection
 * Enable or disable ID protection
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { domain: string } }
) {
    let user = null;
    let domainData = null;
    const domain = params.domain;
    let cookieStore;
    let supabase: any;

    try {
        cookieStore = await cookies();
        supabase = createClient(cookieStore);
        const authResult = await supabase.auth.getUser();
        user = authResult.data.user;

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate Limiting
        const isAllowed = await checkRateLimit(supabase, user.id, 'id_protection_update', 10, 1);
        if (!isAllowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

        const body = await request.json();
        const { enabled } = body;

        if (typeof enabled !== 'boolean') {
            return NextResponse.json(
                { error: 'Invalid request: enabled boolean is required' },
                { status: 400 }
            );
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

        // Get current status for audit log
        let currentStatus = null;
        try {
            currentStatus = await getDomainIDProtection(domain);
        } catch (e) {
            console.warn('Failed to fetch current ID protection status', e);
        }

        // Update ID protection via Go54
        const result = await updateDomainIDProtection(domain, enabled);

        // Log success
        await logAudit(supabase, {
            user_id: user.id,
            merchant_id: domainData.merchant_id,
            action: 'id_protection.update',
            resource_type: 'id_protection',
            resource_id: domain,
            changes: {
                before: currentStatus,
                after: { enabled }
            },
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
            status: 'success'
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating ID protection:', error);

        // Log failure
        if (user && supabase) {
            await logAudit(supabase, {
                user_id: user.id,
                merchant_id: domainData?.merchant_id,
                action: 'id_protection.update',
                resource_type: 'id_protection',
                resource_id: domain,
                status: 'failure',
                error_message: error.message || 'Unknown error'
            });
        }

        return NextResponse.json(
            { error: 'Failed to update ID protection' },
            { status: 500 }
        );
    }
}
