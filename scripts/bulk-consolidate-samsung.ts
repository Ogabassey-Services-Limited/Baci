
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function bulkConsolidateSamsung() {
    console.log('🔄 Starting Samsung Bulk Consolidation...');

    // 1. Fetch all 'Samsung' products
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .ilike('brand', 'Samsung')
        .neq('status', 'archived');

    if (error) throw error;
    console.log(`📦 Loaded ${products.length} Samsung products.`);

    // 2. Group by Base Name
    const productGroups: Record<string, typeof products> = {};

    products.forEach(p => {
        // Remove condition suffixes
        const baseName = p.name
            .replace(/\s\(?((Brand )?New|Used|Open Box|Refurbished|Grade [A-C])\)?$/i, '')
            .trim();

        if (!productGroups[baseName]) {
            productGroups[baseName] = [];
        }
        productGroups[baseName].push(p);
    });

    // 3. Process Groups with > 1 item
    const duplicates = Object.entries(productGroups).filter(([_, group]) => group.length > 1);
    console.log(`Found ${duplicates.length} groups to consolidate.`);

    for (const [baseName, group] of duplicates) {
        if (baseName.includes('S24')) continue; // Skip S24, already done

        console.log(`\nProcessing Group: "${baseName}" (${group.length} variants)`);

        // Determine Parent
        // Prefer "New" condition, or the one already marked as parent, or the one with images
        let parent = group.find(p => p.is_parent) ||
            group.find(p => /new/i.test(p.condition || p.name)) ||
            group.find(p => p.images && p.images.length > 0) ||
            group[0];

        // Ensure Parent is valid and active
        console.log(`   Selected Parent: ${parent.name} (ID: ${parent.id})`);

        // Update Parent
        const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check if we need to update the parent row specifically (e.g. clean name, set is_parent)
        const { error: parentError } = await supabase
            .from('products')
            .update({
                is_parent: true,
                parent_product_id: null,
                name: baseName, // Normalize name to base name
                slug: slug, // clean slug
                // Don't overwrite description/images if they exist, but ensure metadata has condition
            })
            .eq('id', parent.id);

        if (parentError) {
            console.error(`   ❌ Failed to update Parent ${parent.id}: ${parentError.message}`);
            // If unique constraint fails (slug collision), we might need to append ID or handle it. 
            // But for bulk consolidation, usually we are merging rows that shouldn't conflict with *other* groups.
            continue;
        }

        // Process Children
        for (const child of group) {
            if (child.id === parent.id) continue;

            let condition = child.condition || (child.name.match(/New|Used|Open Box|Refurbished/i)?.[0] || 'Used');

            console.log(`   Linking Child: ${child.name} -> Parent (Condition: ${condition})`);

            const { error: childError } = await supabase
                .from('products')
                .update({
                    is_parent: false,
                    parent_product_id: parent.id,
                    status: 'active', // Ensure it remains active as a variant? Or should we archive rows and use product_variants? 
                    // Current architecture: Keep rows as variants.
                    metadata: { ...child.metadata, condition: condition }
                })
                .eq('id', child.id);

            if (childError) {
                console.error(`   ❌ Failed to link child ${child.id}: ${childError.message}`);
            }
        }
    }

    console.log('\n✅ Bulk Consolidation Complete.');
}

bulkConsolidateSamsung().catch(console.error);
