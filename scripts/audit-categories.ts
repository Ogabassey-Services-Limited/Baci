
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function auditCategories() {
    // Products with missing or empty categories
    const { data: noCategory } = await supabase
        .from('products')
        .select('id, name, brand, category')
        .or('category.is.null,category.eq.')
        .neq('status', 'archived')
        .order('brand');

    console.log('📂 CATEGORY AUDIT');
    console.log('=================');
    console.log('Products WITHOUT Category:', noCategory?.length || 0);
    console.log('');

    if (noCategory && noCategory.length > 0) {
        // Group by brand
        const byBrand: Record<string, string[]> = {};
        for (const p of noCategory) {
            const brand = p.brand || 'Unknown';
            if (!byBrand[brand]) byBrand[brand] = [];
            byBrand[brand].push(p.name);
        }

        console.log('Missing Categories by Brand:');
        for (const [brand, names] of Object.entries(byBrand).sort((a, b) => b[1].length - a[1].length)) {
            console.log(`  ${brand}: ${names.length}`);
            names.slice(0, 3).forEach(n => console.log(`    - ${n}`));
            if (names.length > 3) console.log(`    ... and ${names.length - 3} more`);
        }
    }

    // Also check for images + categories combined
    const { data: noBoth } = await supabase
        .from('products')
        .select('id, name, brand')
        .or('category.is.null,category.eq.')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived');

    console.log('');
    console.log('Products missing BOTH category AND images:', noBoth?.length || 0);
}

auditCategories();
