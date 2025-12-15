import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Define the complete hierarchy: parent -> children
const hierarchy: Record<string, string[]> = {
    // Smartphones (parent) -> Phone brands
    'Smartphones': ['Tecno', 'Infinix', 'Redmi', 'Oppo', 'vivo', 'itel', 'Samsung', 'Apple', 'Google Pixel'],

    // Gaming (parent) -> Consoles & accessories
    'Gaming': ['PlayStation 4', 'PlayStation 5', 'Nintendo Switch', 'Xbox', 'Steam Deck', 'VR Headsets', 'Gaming Accessories', 'Gift Cards'],

    // Audio (parent) -> Audio types
    'Audio': ['Headphones', 'Earbuds', 'Soundbars', 'Speakers', 'Portable Speakers', 'Party Speakers'],

    // Laptops (parent) -> Laptop brands
    'Laptops': ['MacBook', 'HP', 'Dell', 'Lenovo', 'Asus', 'MSI', 'Gaming Laptops'],

    // TVs - create Smart TVs as parent
    'Smart TVs': ['Samsung TVs', 'LG TVs'],

    // Wearables (parent) -> Wearable types/brands
    'Wearables': ['Apple'],  // Apple Watch falls under Apple which is under Smartphones - may need adjustment

    // Tablets as standalone for now
};

async function fixHierarchy() {
    console.log('🔧 Fixing Category Hierarchy...\n');

    // Get all categories
    const { data: categories, error: fetchError } = await supabase.from('categories').select('id, name, slug, parent_id');

    if (fetchError) {
        console.error('❌ Query failed:', fetchError.message);
        process.exit(1);
    }

    if (!categories) {
        console.error('❌ Failed to fetch categories');
        process.exit(1);
    }

    const catMap = new Map(categories.map(c => [c.name, c]));

    let totalUpdated = 0;

    for (const [parentName, childNames] of Object.entries(hierarchy)) {
        const parent = catMap.get(parentName);
        if (!parent) {
            console.log(`⚠️ Parent category "${parentName}" not found - skipping`);
            continue;
        }

        console.log(`\n📁 ${parentName} (${parent.id})`);

        for (const childName of childNames) {
            const child = catMap.get(childName);
            if (!child) {
                console.log(`   ⚠️ Child "${childName}" not found`);
                continue;
            }

            if (child.parent_id === parent.id) {
                console.log(`   ✓ ${childName} (already set)`);
                continue;
            }

            const { error } = await supabase
                .from('categories')
                .update({ parent_id: parent.id })
                .eq('id', child.id);

            if (error) {
                console.log(`   ❌ ${childName}: ${error.message}`);
            } else {
                console.log(`   ✅ ${childName} → linked to ${parentName}`);
                totalUpdated++;
            }
        }
    }

    console.log(`\n🎉 Total Updated: ${totalUpdated} categories`);

    // Print final tree
    console.log('\n=== FINAL HIERARCHY ===');
    const { data: finalCats, error: finalError } = await supabase.from('categories').select('id, name, parent_id').order('name');

    if (finalError) {
        console.error('❌ Query failed:', finalError.message);
        return;
    }

    if (!finalCats) {
        console.error('❌ No data returned');
        return;
    }

    const parents = finalCats.filter(c => !c.parent_id);

    for (const parent of parents) {
        const children = finalCats.filter(c => c.parent_id === parent.id);
        if (children.length > 0) {
            console.log(`\n📁 ${parent.name}`);
            children.forEach(c => console.log(`   └── ${c.name}`));
        }
    }
}

fixHierarchy().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
