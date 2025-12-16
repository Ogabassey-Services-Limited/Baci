
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkWatches() {
    const { data, error } = await supabase
        .from('products')
        .select('name, category')
        .or('name.ilike.%Apple Watch%,name.ilike.%Samsung Galaxy Watch%')
        .limit(20);

    if (error) console.error(error);
    else {
        console.log('Sample Watch Data:');
        data.forEach(p => console.log(`[${p.category}] ${p.name}`));
    }
}
checkWatches();
