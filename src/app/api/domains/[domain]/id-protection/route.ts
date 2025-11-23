import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getDomainIDProtection, updateDomainIDProtection } from '@/lib/go54';

/**
 * GET /api/domains/[domain]/id-protection
 * Get ID protection (WHOIS privacy) status for a domain
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

        // Get ID protection status from Go54
        const idProtection = await getDomainIDProtection(domain);

        return NextResponse.json(idProtection);
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
 * Enable or disable ID protection (WHOIS privacy) for a domain
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
        const { enabled } = body;

        if (typeof enabled !== 'boolean') {
            return NextResponse.json(
                { error: 'Invalid request: enabled (boolean) is required' },
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

        // Update ID protection via Go54
        const result = await updateDomainIDProtection(domain, enabled);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error updating ID protection:', error);
        return NextResponse.json(
            { error: 'Failed to update ID protection status' },
            { status: 500 }
        );
    }
}
