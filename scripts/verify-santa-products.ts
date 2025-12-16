
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role for admin access

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSantaLogic() {
    console.log('Testing Santa Product Logic...');

    // Ogabassey merchant ID
    const MERCH_SLUG = 'ogabassey';
    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', MERCH_SLUG)
        .single();

    if (!merchant) {
        console.error('Merchant ogabassey not found');
        return;
    }

    console.log('Merchant ID:', merchant.id);

    // Logic from route.ts
    const priceRanges = [
        { min: 5000000, max: 999999999, limit: 30 },
        { min: 2000000, max: 5000000, limit: 50 },
        { min: 1200000, max: 2000000, limit: 80 },
        { min: 800000, max: 1200000, limit: 100 }, // S24 Ultra likely here
        { min: 500000, max: 800000, limit: 80 },
        { min: 200000, max: 500000, limit: 80 },
        { min: 50000, max: 200000, limit: 50 },
        { min: 0, max: 50000, limit: 30 },
    ];

    const allProducts: any[] = [];

    for (const range of priceRanges) {
        const { data: rangeProducts, error } = await supabase
            .from('products')
            .select('name, price, cost_price')
            .eq('merchant_id', merchant.id)
            .eq('status', 'active')
            .gte('price', range.min)
            .lt('price', range.max)
            .order('price', { ascending: false })
            .limit(range.limit);

        if (error) {
            console.error(`Error range ${range.min}-${range.max}:`, error);
        } else if (rangeProducts) {
            allProducts.push(...rangeProducts);
        }
    }

    // Check for S24 Ultra
    const s24 = allProducts.find(p => p.name.toLowerCase().includes('s24 ultra'));

    if (s24) {
        console.log('SUCCESS: Santa can see S24 Ultra!');
        console.log('Product Details:', s24);
    } else {
        console.log('FAILURE: S24 Ultra NOT found in fetched products.');
        // Debug: check if it exists at all
        const { data: rawCheck } = await supabase
            .from('products')
            .select('name, price, status, merchant_id')
            .ilike('name', '%s24 ultra%')
            .eq('merchant_id', merchant.id);
        console.log('Direct DB Check results:', rawCheck);
    }
}

testSantaLogic();
