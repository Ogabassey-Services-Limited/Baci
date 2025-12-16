
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSpecs() {
    console.log('Starting spec check...');
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, product_key_specs, category')
        .not('product_key_specs', 'is', null)
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }
    console.log(`Found ${products.length} products`);

    products?.forEach(p => {
        console.log(`\n--- [${p.name}] ---`);
        console.log('Specs Column:', JSON.stringify(p.specs, null, 2));
        console.log('---------------------');
    });
}

checkSpecs();
