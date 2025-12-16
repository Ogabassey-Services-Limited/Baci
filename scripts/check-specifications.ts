
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSpecs() {
    const { data: products } = await supabase
        .from('products')
        .select('name, specifications, schema_markup')
        .not('specifications', 'is', null)
        .limit(5);

    products?.forEach(p => {
        console.log(`\n--- [${p.name}] ---`);
        console.log('Specifications:', JSON.stringify(p.specifications, null, 2).substring(0, 200));
        console.log('Schema Markup:', JSON.stringify(p.schema_markup, null, 2).substring(0, 200));
    });
}

checkSpecs();
