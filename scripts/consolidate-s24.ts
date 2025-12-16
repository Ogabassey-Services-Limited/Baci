
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function consolidateS24() {
    console.log('🔄 Starting S24 Consolidation (v2 - Update/Promote Mode)...');

    // 1. Fetch S24 Products
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%Samsung Galaxy S24%')
        .neq('status', 'archived');

    if (error) throw error;
    if (!products.length) return console.log('No S24 products found.');

    console.log(`Found ${products.length} S24 products.`);

    const models = ['Samsung Galaxy S24', 'Samsung Galaxy S24+', 'Samsung Galaxy S24 Ultra', 'Samsung Galaxy S24 FE'];

    for (const model of models) {
        const variants = products.filter(p => {
            const name = p.name.trim();
            if (name === model) return true;
            if (name.startsWith(model + ' ')) return true;
            return false;
        }).filter(p => {
            if (model === 'Samsung Galaxy S24' && (p.name.includes('+') || p.name.includes('Plus') || p.name.includes('Ultra') || p.name.includes('FE'))) return false;
            return true;
        });

        if (variants.length === 0) continue;

        console.log(`\nProcessing ${model} (${variants.length} rows)...`);

        // Check if parent already exists (is_parent = true and name = model)
        let parent = variants.find(p => p.is_parent && p.name === model);

        // Check if a potential parent row already exists (by exact name match) even if not marked is_parent
        const existingRow = variants.find(p => p.name === model);

        if (parent) {
            console.log(`   Parent already exists and is active: ${parent.id}`);
        } else if (existingRow) {
            console.log(`   Found existing row for ${model} (ID: ${existingRow.id}). Promoting to Parent.`);
            // Promote to parent
            const { data: updatedParent, error: updateError } = await supabase
                .from('products')
                .update({
                    is_parent: true,
                    parent_product_id: null, // Ensure it's not a child
                    slug: model.toLowerCase().replace(/ /g, '-').replace(/\+/g, '-plus') // Ensure clean slug
                })
                .eq('id', existingRow.id)
                .select()
                .single();

            if (updateError) {
                console.error(`   Failed to promote ${model}: ${updateError.message}`);
                continue;
            }
            parent = updatedParent;
        } else {
            console.log(`   Creating NEW parent for ${model}...`);
            const template = variants[0];

            const { data: newParent, error: createError } = await supabase
                .from('products')
                .insert({
                    name: model,
                    slug: model.toLowerCase().replace(/ /g, '-').replace(/\+/g, '-plus'),
                    brand: 'Samsung',
                    description: template.description,
                    images: template.images,
                    category: 'Smartphones',
                    is_parent: true,
                    status: 'active',
                    merchant_id: template.merchant_id,
                    price: template.price
                })
                .select()
                .single();

            if (createError) {
                console.error(`   Failed to create parent: ${createError.message}`);
                continue;
            }
            parent = newParent;
        }

        // Link variants to parent
        for (const v of variants) {
            if (v.id === parent.id) continue; // Skip self

            // Determine variant attributes
            let storage = v.name.match(/(\d+)(GB|TB)/i)?.[0] || '256GB'; // Default fallback
            let ram = v.name.match(/(\d+)GB RAM/i)?.[1] || 8;
            let condition = v.condition || (v.name.match(/New|Used|Open Box|Refurbished/i)?.[0] || 'New');

            console.log(`   Linking ${v.name} -> Parent (Storage: ${storage}, Condition: ${condition})`);

            const { error: updateError } = await supabase
                .from('products')
                .update({
                    parent_product_id: parent.id,
                    is_parent: false,
                    metadata: { ...v.metadata, storage, condition }
                })
                .eq('id', v.id);

            if (updateError) console.error(`Failed to link ${v.name}: ${updateError.message}`);
        }
    }

    console.log('\n✅ S24 Consolidation Complete.');
}

consolidateS24().catch(console.error);
