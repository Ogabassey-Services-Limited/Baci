
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function audit() {
    // Total active products
    const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true }).neq('status', 'archived');

    // Missing images
    const { data: missing } = await supabase.from('products').select('id, name, brand').or('images.is.null,images.eq.[]').neq('status', 'archived');

    console.log('📊 IMAGE AUDIT SUMMARY');
    console.log('=====================');
    console.log('Total Active Products:', total);
    console.log('Products WITH Images:', (total || 0) - (missing?.length || 0));
    console.log('Products MISSING Images:', missing?.length || 0);
    console.log('');

    // Group by brand
    const byBrand: Record<string, string[]> = {};
    for (const p of missing || []) {
        const brand = p.brand || 'Unknown';
        if (!byBrand[brand]) byBrand[brand] = [];
        byBrand[brand].push(p.name);
    }

    console.log('MISSING BY BRAND:');
    const sorted = Object.entries(byBrand).sort((a, b) => b[1].length - a[1].length);
    for (const [brand, names] of sorted) {
        console.log(`  ${brand}: ${names.length}`);
        names.slice(0, 3).forEach(n => console.log(`    - ${n}`));
        if (names.length > 3) console.log(`    ... and ${names.length - 3} more`);
    }
}
audit();
