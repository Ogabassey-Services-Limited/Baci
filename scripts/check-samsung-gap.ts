import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSamsung() {
    const { data: allProducts, error } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .ilike('name', '%samsung%');

    if (error) {
        console.error('❌ Query failed:', error.message);
        return;
    }

    // Unmatched
    const unmatched = allProducts?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];

    console.log(`📉 Total Samsung Products: ${allProducts?.length}`);
    console.log(`📉 Unmatched Samsung Products: ${unmatched.length}`);

    if (unmatched.length > 0) {
        console.log('\nSample Unmatched Samsung Products:');
        unmatched.slice(0, 20).forEach(p => console.log(`- ${p.name}`));
    }
}

checkSamsung().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
