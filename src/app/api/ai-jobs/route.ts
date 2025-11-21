import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// POST /api/ai-jobs - Create a new AI job
export async function POST(request: NextRequest) {
    try {
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

        const body = await request.json();
        const { type, input } = body;

        if (!type || !input) {
            return NextResponse.json(
                { error: 'Missing required fields: type, input' },
                { status: 400 }
            );
        }

        // Create job
        const { data: job, error: jobError } = await supabase
            .from('ai_jobs')
            .insert({
                merchant_id: merchant.id,
                type,
                input,
                status: 'pending',
            })
            .select()
            .single();

        if (jobError) {
            console.error('Error creating AI job:', jobError);
            return NextResponse.json(
                { error: 'Failed to create job' },
                { status: 500 }
            );
        }

        return NextResponse.json({ job }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error in POST /api/ai-jobs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET /api/ai-jobs - Get jobs for the merchant
export async function GET(request: NextRequest) {
    try {
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

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '10');

        let query = supabase
            .from('ai_jobs')
            .select('*')
            .eq('merchant_id', merchant.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status) {
            query = query.eq('status', status);
        }

        const { data: jobs, error } = await query;

        if (error) {
            console.error('Error fetching AI jobs:', error);
            return NextResponse.json(
                { error: 'Failed to fetch jobs' },
                { status: 500 }
            );
        }

        return NextResponse.json({ jobs });
    } catch (error) {
        console.error('Unexpected error in GET /api/ai-jobs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
