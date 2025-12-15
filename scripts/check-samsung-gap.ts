import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSamsung() {
    const { data: allProducts } = await supabase
        .from('products')
        .select('id, name, slug, images')
        .ilike('name', '%samsung%');

    // Unmatched
    const unmatched = allProducts?.filter(p => !p.images || p.images.length === 0 || p.images[0] === null) || [];

    console.log(`📉 Total Samsung Products: ${allProducts?.length}`);
    console.log(`📉 Unmatched Samsung Products: ${unmatched.length}`);

    if (unmatched.length > 0) {
        console.log('\nSample Unmatched Samsung Products:');
        unmatched.slice(0, 20).forEach(p => console.log(`- ${p.name}`));
    }
}

checkSamsung();
