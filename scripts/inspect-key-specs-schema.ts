
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inspectKeySpecsSchema() {
    console.log('=== product_key_specs TABLE SCHEMA ===\n');

    // Get schema info by fetching a row and logging keys
    const { data, error } = await supabase
        .from('product_key_specs')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log(`Total Columns: ${columns.length}\n`);
        console.log('Columns:');
        columns.forEach(col => console.log(`  - ${col}`));
    } else {
        console.log('No data found in product_key_specs table');
    }

    // Count stats
    console.log('\n=== COVERAGE STATS ===\n');

    const { count: totalProducts } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'archived');

    const { count: productsWithSpecs } = await supabase
        .from('product_key_specs')
        .select('id', { count: 'exact', head: true });

    console.log(`Total Active Products: ${totalProducts}`);
    console.log(`Products with Key Specs: ${productsWithSpecs}`);
    const coverage = totalProducts ? ((productsWithSpecs || 0) / totalProducts * 100).toFixed(1) : '0';
    console.log(`Coverage: ${coverage}%`);
}

inspectKeySpecsSchema();
