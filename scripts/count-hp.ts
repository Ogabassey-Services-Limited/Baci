import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function count() {
    const { data, error } = await supabase
        .from('products')
        .select('name')
        .ilike('name', 'HP%')
        .ilike('name', '%(New)%');

    if (error) {
        console.error('❌ Query failed:', error.message);
        process.exit(1);
    }

    if (!data) {
        console.error('❌ No data returned');
        process.exit(1);
    }

    console.log(`\n📊 New HP Laptops in Supabase: ${data.length}`);
    console.log('Sample:');
    data.slice(0, 10).forEach(p => console.log(`- ${p.name}`));

    // Also count Used
    const { count: usedCount, error: usedError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .ilike('name', 'HP%')
        .not('name', 'ilike', '%(New)%');

    if (usedError) {
        console.error('❌ Count query failed:', usedError.message);
        return;
    }

    console.log(`\n📊 Used/Refurb HP Laptops: ${usedCount || 0}`);
}

count();
