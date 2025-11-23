import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getDomainDNSRecords, updateDomainDNSRecords } from '@/lib/go54';

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
        const { records } = body;

        if (!records || !Array.isArray(records)) {
            return NextResponse.json(
                { error: 'Invalid request: records array is required' },
                { status: 400 }
            );
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

        // Update DNS records via Go54
        const result = await updateDomainDNSRecords(domain, records);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error updating DNS records:', error);
        return NextResponse.json(
            { error: 'Failed to update DNS records' },
            { status: 500 }
        );
    }
}
