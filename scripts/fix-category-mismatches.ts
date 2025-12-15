import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Complete mapping of incorrect -> correct category names
const categoryFixes: Record<string, string> = {
    // UUIDs to proper names
    '0e392424-1963-442d-a5b9-e5ae3831360e': 'Nintendo Switch',
    '42f1b709-967d-4fde-9688-2f10d99de3c2': 'Gift Cards',
    '449254b2-42d2-4573-8125-cdd4f9f153e3': 'Earbuds',
    '44c89b66-1539-4324-ba4d-49091e2a1248': 'Soundbars',
    '79fef998-5dcb-4a83-9163-fb02deb4462b': 'LG TVs',
    '7ec7d649-c523-4763-bd06-61ef8e5504c1': 'Headphones',
    '8f66d335-93a0-435c-877b-4a42b06c1839': 'Gaming Accessories',
    'ab1bee40-c986-4ee1-acb2-4f9e22e28c0c': 'Oppo',
    'be322cac-bc7c-469e-812b-95048fe30609': 'Samsung TVs',

    // Case/naming inconsistencies
    'Phones': 'Smartphones',
    'smartphones': 'Smartphones',
    'audio': 'Audio',
    'tablets': 'Tablets',
    'wearables': 'Wearables',
    'accessories': 'Accessories',
    'itel': 'itel',      // Already correct
    'vivo': 'vivo',      // Already correct
};

async function fixCategories() {
    console.log('🔧 Fixing Category Mismatches...\n');

    let totalFixed = 0;

    for (const [oldCategory, newCategory] of Object.entries(categoryFixes)) {
        if (oldCategory === newCategory) continue; // Skip if already correct

        const { data, error } = await supabase
            .from('products')
            .update({ category: newCategory })
            .eq('category', oldCategory)
            .select('id');

        if (error) {
            console.error(`Error fixing ${oldCategory}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`✅ ${oldCategory} → ${newCategory}: ${data.length} products`);
            totalFixed += data.length;
        }
    }

    console.log(`\n🎉 Total Fixed: ${totalFixed} products`);

    // Verify results
    console.log('\n=== VERIFICATION ===');
    const { data: products } = await supabase.from('products').select('category');
    const distinct = [...new Set(products?.map(p => p.category))].sort();
    console.log('Distinct categories now:', distinct.length);
    distinct.forEach(c => console.log('  - ' + c));
}

fixCategories();
