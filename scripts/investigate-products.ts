
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateProducts() {
    console.log('=== Product Data Investigation ===\n');

    // 1. Total products count
    const { count: totalCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
    console.log(`Total Products: ${totalCount}`);

    // 2. Products WITH brand vs WITHOUT brand
    const { count: withBrand } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .not('brand', 'is', null)
        .neq('brand', '');
    console.log(`Products WITH brand: ${withBrand}`);
    console.log(`Products WITHOUT brand: ${(totalCount || 0) - (withBrand || 0)}`);

    // 3. Sample of products (showing name, brand, category)
    console.log('\n--- Sample Products (first 10) ---');
    const { data: sampleProducts } = await supabase
        .from('products')
        .select('id, name, brand, category, status')
        .limit(10);

    if (sampleProducts) {
        sampleProducts.forEach(p => {
            console.log(`- "${p.name}" | Brand: "${p.brand || 'EMPTY'}" | Category: "${p.category}" | Status: ${p.status}`);
        });
    }

    // 4. Search for Apple-related products by NAME
    console.log('\n--- Products with "iPhone" or "Apple" in name ---');
    const { data: appleProducts } = await supabase
        .from('products')
        .select('id, name, brand, category')
        .or('name.ilike.%iPhone%,name.ilike.%Apple%,name.ilike.%MacBook%')
        .limit(10);

    if (appleProducts && appleProducts.length > 0) {
        console.log(`Found ${appleProducts.length} Apple-related products:`);
        appleProducts.forEach(p => {
            console.log(`- "${p.name}" | Brand column: "${p.brand || 'EMPTY'}"`);
        });
    } else {
        console.log('No products found with Apple/iPhone/MacBook in name.');
    }

    // 5. Check unique brands
    console.log('\n--- All Unique Brands in DB ---');
    const { data: allProducts } = await supabase
        .from('products')
        .select('brand')
        .limit(500);

    if (allProducts) {
        const uniqueBrands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))];
        console.log(`Unique brands found: ${uniqueBrands.length > 0 ? uniqueBrands.join(', ') : 'NONE'}`);
    }
}

investigateProducts();
