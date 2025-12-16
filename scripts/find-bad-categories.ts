
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function findBadCategories() {
    // Find products with UUID-like categories
    const { data: badCats } = await supabase
        .from('products')
        .select('id, name, brand, category')
        .like('category', '%-%-%-%-%')  // UUID pattern
        .neq('status', 'archived');

    console.log('🚨 PRODUCTS WITH UUID CATEGORIES');
    console.log('=================================');
    console.log('Count:', badCats?.length || 0);

    if (badCats && badCats.length > 0) {
        for (const p of badCats) {
            console.log(`  - ${p.name} (Brand: ${p.brand})`);
            console.log(`    Category: ${p.category}`);
        }
    }

    // Also find products where brand = category (misuse)
    console.log('\n');
    console.log('🔄 PRODUCTS WHERE BRAND = CATEGORY (Potential Misuse)');
    console.log('====================================================');

    const brandCategories = ['Samsung', 'Oppo', 'Tecno', 'vivo', 'itel', 'Redmi', 'Apple'];
    for (const bc of brandCategories) {
        const { data: brandAsCat } = await supabase
            .from('products')
            .select('id, name')
            .eq('category', bc)
            .neq('status', 'archived')
            .limit(3);

        if (brandAsCat && brandAsCat.length > 0) {
            console.log(`  ${bc} (used as category):`);
            brandAsCat.forEach(p => console.log(`    - ${p.name}`));
        }
    }
}

findBadCategories();
