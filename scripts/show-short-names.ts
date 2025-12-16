
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function showShortNames() {
    console.log('Fetching short product names (< 10 chars)...\n');

    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, brand, category')
        .neq('status', 'archived'); // We will filter in JS because length filtering in SQL is verbose

    if (error || !products) {
        console.error('Error fetching products');
        return;
    }

    const short = products.filter(p => p.name.length < 10);

    console.log(`Found ${short.length} products with short names. Here are top 30:\n`);

    // Sort by name for easier reading
    short.sort((a, b) => a.name.localeCompare(b.name));

    short.slice(0, 30).forEach(p => {
        console.log(`- [${p.brand || 'No Brand'}] "${p.name}" (${p.category})`);
    });
}

showShortNames();
