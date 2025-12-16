
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSample() {
    const { data: products } = await supabase
        .from('products')
        .select('name, description')
        .limit(5);

    products?.forEach(p => {
        console.log(`\n--- [${p.name}] ---`);
        console.log(p.description.substring(0, 500));
        console.log('---------------------');
    });
}

checkSample();
