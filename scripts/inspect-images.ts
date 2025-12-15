
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectProducts() {
    console.log('Fetching merchant "ogabassey"...');

    // Get Merchant ID
    const { data: merchant, error: mError } = await supabase
        .from('merchants')
        .select('id, slug')
        .eq('slug', 'ogabassey')
        .single();

    if (mError || !merchant) {
        console.error('Merchant not found:', mError);
        return;
    }

    console.log(`Found merchant: ${merchant.slug} (${merchant.id})`);

    // Get Products
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, images, image_hint')
        .eq('merchant_id', merchant.id)
        .limit(5);

    if (pError) {
        console.error('Error fetching products:', pError);
        return;
    }

    console.log(`Found ${products.length} products. Inspecting first 5:`);
    products.forEach(p => {
        console.log(`\nProduct: ${p.name} (${p.id})`);
        console.log('  images (column type):', typeof p.images, Array.isArray(p.images) ? 'Array' : 'Not Array');
        console.log('  images (value):', JSON.stringify(p.images, null, 2));
    });
}

inspectProducts();
