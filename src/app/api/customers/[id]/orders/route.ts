import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);

        // Get the current user
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get merchant_id for the current user
        const { data: merchant } = await supabase
            .from('merchants')
            .select('id')
            .eq('user_id', user.id)
            .single();

        if (!merchant) {
            return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
        }

        // Fetch orders for this customer
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
        *,
        items:order_items(*)
      `)
            .eq('customer_id', id)
            .eq('merchant_id', merchant.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ orders: orders || [] });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
