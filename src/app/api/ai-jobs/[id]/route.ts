import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// GET /api/ai-jobs/[id] - Get a specific AI job
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get merchant record
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

        // Get job (ensure it belongs to this merchant)
        const { data: job, error: jobError } = await supabase
            .from('ai_jobs')
            .select('*')
            .eq('id', id)
            .eq('merchant_id', merchant.id)
            .single();

        if (jobError || !job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ job });
    } catch (error) {
        console.error('Unexpected error in GET /api/ai-jobs/[id]:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
