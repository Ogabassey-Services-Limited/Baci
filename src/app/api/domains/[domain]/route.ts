import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getDomainInformation, getDomainNameservers, getDomainLock, updateDomainNameservers, updateDomainLock } from '@/lib/go54';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
) {
    try {
        const { domain } = await params;
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // TODO: Verify domain belongs to user (check database)

        // Fetch all info in parallel
        const [info, nameservers, lock] = await Promise.all([
            getDomainInformation(domain),
            getDomainNameservers(domain),
            getDomainLock(domain)
        ]);

        return NextResponse.json({
            info,
            nameservers,
            lock
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch domain details';
        console.error('Error fetching domain details:', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
) {
    try {
        const { domain } = await params;
        const body = await request.json();
        const { action, data } = body;

        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let result;

        switch (action) {
            case 'update_nameservers':
                result = await updateDomainNameservers(domain, data);
                break;
            case 'update_lock':
                result = await updateDomainLock(domain, data.lock);
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json(result);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update domain';
        console.error('Error updating domain:', error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
