
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const WEARABLE_KEYWORDS = ['Watch', 'Band', 'Fitbit', 'Garmin', 'iWatch'];

async function fixWearables() {
    console.log('🔧 Consolidating Wearables into Smartwatches...\n');

    // Fetch products in 'Wearables' category
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('category', 'Wearables')
        .neq('status', 'archived');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    if (!products || products.length === 0) {
        console.log('No "Wearables" found that need fixing.');
        return;
    }

    const toFix = products.filter(p =>
        WEARABLE_KEYWORDS.some(k => p.name.toLowerCase().includes(k.toLowerCase()))
    );

    console.log(`Found ${toFix.length} Wearables to move to Smartwatches.`);

    for (const p of toFix) {
        console.log(`  Updating: ${p.name}`);

        const { error: updateError } = await supabase
            .from('products')
            .update({ category: 'Smartwatches' })
            .eq('id', p.id);

        if (updateError) {
            console.error(`  ❌ Failed to update ${p.name}:`, updateError.message);
        }
    }

    console.log(`\n🎉 Consolidated ${toFix.length} items.`);
}

fixWearables().catch(console.error);
