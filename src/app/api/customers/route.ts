import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant_id
    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (!merchant) {
        return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    let query = supabase
        .from('customers')
        .select('*')
        .eq('merchant_id', merchant.id)
        .order('created_at', { ascending: false });

    if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers });
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    try {
        const body = await request.json();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: merchant } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (!merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        const { data: customer, error } = await supabase
            .from('customers')
            .insert({
                ...body,
                merchant_id: merchant.id,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ customer });
    } catch (_) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
