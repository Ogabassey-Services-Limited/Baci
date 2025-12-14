import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function count() {
    const { data, Uncount, error } = await supabase
        .from('products')
        .select('name')
        .ilike('name', 'HP%')
        .ilike('name', '%(New)%');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`\n📊 New HP Laptops in Supabase: ${data.length}`);
    console.log('Sample:');
    data.slice(0, 10).forEach(p => console.log(`- ${p.product_name}`));

    // Also count Used
    const { count: usedCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .ilike('name', 'HP%')
        .not('name', 'ilike', '%(New)%');

    console.log(`\n📊 Used/Refurb HP Laptops: ${usedCount || 0}`);
}

count();
