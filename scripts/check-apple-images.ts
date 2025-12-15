import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBrands() {
    console.log('Checking brands and Apple products...');

    // 1. List distinct brands (first 50)
    const { data: products, error } = await supabase
        .from('products')
        .select('brand')
        .limit(50);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    const brands = Array.from(new Set(products?.map(p => p.brand).filter(Boolean)));
    console.log('Available Brands found in DB:', brands);

    // 2. Specific Apple check
    const { data: appleProducts, error: appleError } = await supabase
        .from('products')
        .select('id, name, images, status')
        .ilike('brand', '%Apple%')  // fuzzy match
        .limit(5);

    if (appleError) {
        console.error('Error fetching Apple products:', appleError);
        return;
    }

    if (appleProducts && appleProducts.length > 0) {
        console.log(`Found ${appleProducts.length} Apple-like products:`);
        appleProducts.forEach(p => {
            console.log(`- ${p.name}: Images=${p.images ? p.images.length : 0} (Status: ${p.status})`);
        });
    } else {
        console.log('No products found with brand likely "Apple"');
    }
}

await checkBrands();
