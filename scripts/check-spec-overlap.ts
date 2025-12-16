
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSpecOverlap() {
    // Count where OLD exists but NEW is missing
    const { data: migrationCandidates, error: err1 } = await supabase
        .from('products')
        .select('id')
        .not('specifications', 'is', null)
        .is('product_key_specs', null);

    // Count where NEW exists
    const { data: modernProducts, error: err2 } = await supabase
        .from('products')
        .select('id')
        .not('product_key_specs', 'is', null);

    // Count where BOTH exist
    const { data: bothExist, error: err3 } = await supabase
        .from('products')
        .select('id')
        .not('specifications', 'is', null)
        .not('product_key_specs', 'is', null);

    console.log('--- Spec Overlap Analysis ---');
    console.log(`Products with Legacy Specs ONLY (Needs Migration): ${migrationCandidates?.length || 0}`);
    console.log(`Products with Modern Specs (Good):                 ${modernProducts?.length || 0}`);
    console.log(`Products with BOTH (Check for Duplicate Content):  ${bothExist?.length || 0}`);

    if (err1) console.error('Error 1:', err1);
    if (err2) console.error('Error 2:', err2);
    if (err3) console.error('Error 3:', err3);
}

checkSpecOverlap();
