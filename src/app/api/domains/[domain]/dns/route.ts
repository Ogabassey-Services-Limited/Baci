import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getDomainDNSRecords, updateDomainDNSRecords } from '@/lib/go54';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logAudit } from '@/lib/audit-logger';
import { validateDNSRecordBatch } from '@/lib/dns-validator';

/**
 * GET /api/domains/[domain]/dns
 * Get DNS records for a domain
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
        const isAllowed = await checkRateLimit(supabase, user.id, 'dns_read', 100, 1);
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

        // Get DNS records from Go54
        const dnsRecords = await getDomainDNSRecords(domain);

        return NextResponse.json(dnsRecords);
    } catch (error) {
        console.error('Error fetching DNS records:', error);
        return NextResponse.json(
            { error: 'Failed to fetch DNS records' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/domains/[domain]/dns
 * Update DNS records for a domain
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

        // Rate Limiting (Stricter for updates)
        const isAllowed = await checkRateLimit(supabase, user.id, 'dns_update', 10, 1);
        if (!isAllowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429, headers: { 'Retry-After': '60' } }
            );
        }

        const body = await request.json();
        const { records } = body;

        if (!records || !Array.isArray(records)) {
            return NextResponse.json(
                { error: 'Invalid request: records array is required' },
                { status: 400 }
            );
        }

        // DNS Validation
        const validation = validateDNSRecordBatch(records);
        if (!validation.valid) {
            return NextResponse.json(
                {
                    error: 'DNS record validation failed',
                    details: validation.errors,
                    warnings: validation.warnings
                },
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

        // Get current records for audit log
        let currentRecords = [];
        try {
            currentRecords = await getDomainDNSRecords(domain);
        } catch (e) {
            console.warn('Failed to fetch current records for audit log', e);
        }

        // Update DNS records via Go54
        const result = await updateDomainDNSRecords(domain, records);

        // Log success
        await logAudit(supabase, {
            user_id: user.id,
            merchant_id: domainData.merchant_id,
            action: 'dns.update',
            resource_type: 'dns',
            resource_id: domain,
            changes: {
                before: currentRecords,
                after: records
            },
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown',
            status: 'success'
        });

        return NextResponse.json({
            ...result,
            warnings: validation.warnings.length > 0 ? validation.warnings : undefined
        });
    } catch (error: any) {
        console.error('Error updating DNS records:', error);

        // Log failure if we have user context
        if (user && supabase) {
            await logAudit(supabase, {
                user_id: user.id,
                merchant_id: domainData?.merchant_id,
                action: 'dns.update',
                resource_type: 'dns',
                resource_id: domain,
                status: 'failure',
                error_message: error.message || 'Unknown error'
            });
        }

        return NextResponse.json(
            { error: 'Failed to update DNS records' },
            { status: 500 }
        );
    }
}
