
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// UUID to proper category mapping
const UUID_CATEGORY_MAP: Record<string, string> = {
    '582dfa3f-8a3e-4407-8040-46325029775e': 'Audio',          // JBL, Green Lion speakers
    '131d13c6-a23b-46fb-921a-d8179ff89374': 'PlayStation 5',  // PS5 consoles
    '24e0598e-fbe4-4e74-a1c1-eaf813e23d08': 'Xbox',           // Xbox Series X
    '23689167-8bd5-4619-8e57-49a6fc53f7dc': 'Portable Gaming',// Steam Deck
    '3fb67536-ce44-4f3e-bd37-32983e61575d': 'Audio',          // Duplicate JBL
    '00112d2f-8194-4d8d-90e8-b89974b9b067': 'Audio',          // Party speakers
};

async function fixUuidCategories() {
    console.log('🔧 Fixing UUID Categories...\n');

    let totalFixed = 0;

    for (const [uuid, correctCategory] of Object.entries(UUID_CATEGORY_MAP)) {
        // Find products with this UUID as category
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, category')
            .eq('category', uuid)
            .neq('status', 'archived');

        if (error) {
            console.error('Error fetching:', error.message);
            continue;
        }

        if (!products || products.length === 0) {
            console.log(`No products found with UUID: ${uuid.substring(0, 8)}...`);
            continue;
        }

        console.log(`📦 UUID: ${uuid.substring(0, 8)}... → "${correctCategory}" (${products.length} products)`);

        // Update all products with this UUID
        const { error: updateError } = await supabase
            .from('products')
            .update({ category: correctCategory })
            .eq('category', uuid);

        if (updateError) {
            console.error('   ❌ Update failed:', updateError.message);
        } else {
            console.log(`   ✅ Updated ${products.length} products`);
            products.slice(0, 3).forEach(p => console.log(`      - ${p.name}`));
            if (products.length > 3) console.log(`      ... and ${products.length - 3} more`);
            totalFixed += products.length;
        }
    }

    console.log(`\n🎉 Total Fixed: ${totalFixed} products`);
}

fixUuidCategories().catch(console.error);
