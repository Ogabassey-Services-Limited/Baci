
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CORRECTIONS = [
    {
        fromCategory: 'Smartphones',
        targetCategory: 'Tablets',
        keywords: ['Pad', 'Tablet', 'Tab', 'MatePad']
    },
    {
        fromCategory: 'Smartphones',
        targetCategory: 'Smartwatches',
        keywords: ['Watch', 'Band', 'Fitbit', 'Garmin']
    }
];

async function fixMisclassified() {
    console.log('🔧 Fixing Misclassified Items in "Smartphones"...\n');

    for (const correction of CORRECTIONS) {
        // Fetch potential matches
        const { data: products } = await supabase
            .from('products')
            .select('id, name, category')
            .eq('category', correction.fromCategory)
            .neq('status', 'archived');

        if (!products) continue;

        const toFix = products.filter(p =>
            correction.keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase()))
        );

        if (toFix.length === 0) {
            console.log(`No products found for ${correction.targetCategory}`);
            continue;
        }

        console.log(`Found ${toFix.length} potential ${correction.targetCategory}:`);

        for (const p of toFix) {
            console.log(`  Updating: ${p.name} -> ${correction.targetCategory}`);

            const { error } = await supabase
                .from('products')
                .update({ category: correction.targetCategory })
                .eq('id', p.id);

            if (error) console.error('  ❌ Error:', error.message);
        }
    }
}

fixMisclassified().catch(console.error);
