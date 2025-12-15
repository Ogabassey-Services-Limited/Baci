
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Product {
    id: string;
    merchant_id: string;
    name: string;
    condition: string | null;
    brand: string | null;
    price: number;
    stock: number;
    images: string[];
    description: string;
    status: string;
}

// Helper to determine normalized condition from name or field
function detectCondition(p: Product): { condition: 'new' | 'used' | 'open_box' | 'refurbished', cleanName: string } {
    const name = p.name.toLowerCase();
    let condition: 'new' | 'used' | 'open_box' | 'refurbished' = 'new';
    let cleanName = p.name;

    if (p.condition) {
        // Trust explicit field if valid
        const c = p.condition.toLowerCase();
        if (c.includes('used')) condition = 'used';
        else if (c.includes('open')) condition = 'open_box';
        else if (c.includes('refurb')) condition = 'refurbished';
    } else {
        // Fallback to name parsing
        if (name.includes('used')) condition = 'used';
        else if (name.includes('open box')) condition = 'open_box';
        else if (name.includes('refurbished')) condition = 'refurbished';
    }

    // Remove condition keywords from name
    cleanName = cleanName
        .replace(/\s*\(?(New|Brand New)\)?\s*$/i, '')
        .replace(/\s*\(?(Used|UK Used|US Used|Fairly Used)\)?\s*$/i, '')
        .replace(/\s*\(?(Open Box)\)?\s*$/i, '')
        .replace(/\s*\(?(Refurbished)\)?\s*$/i, '')
        .trim();

    return { condition, cleanName };
}

async function main() {
    console.log('🚀 Starting Condition-Based Deduplication Migration...\n');

    // 1. Fetch all active products
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .neq('status', 'archived')
        .order('name');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`📊 Total active products: ${products.length}\n`);

    // 2. Group by normalized name
    const groups: Record<string, Product[]> = {};

    products.forEach((p: Product) => {
        const { cleanName } = detectCondition(p);
        const key = cleanName.toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    });

    // 3. Filter for duplicates
    const duplicateFamilies = Object.entries(groups).filter(([_, items]) => items.length > 1);
    console.log(`found ${duplicateFamilies.length} families to merge.`);

    let totalMerged = 0;
    let totalArchived = 0;

    for (const [baseName, family] of duplicateFamilies) {
        console.log(`\nProcessing: "${baseName}" (${family.length} variants)`);

        // Strategy: Find the best "Parent"
        // Preference: Explicit 'new' condition > highest price > first created
        let parent = family.find(p => detectCondition(p).condition === 'new');
        if (!parent) {
            // If no new, sort by price desc (usually better quality)
            parent = family.sort((a, b) => b.price - a.price)[0];
        }

        if (!parent) continue; // Should not happen

        console.log(`   🌟 Parent chosen: ${parent.name} (${parent.id})`);

        // Prepare offers
        for (const p of family) {
            const { condition } = detectCondition(p);

            console.log(`   -> Merging ${p.name} as '${condition}' offer...`);

            // 1. Insert into product_offers
            const { error: offerError } = await supabase
                .from('product_offers')
                .upsert({
                    product_id: parent.id, // Always link to Parent
                    merchant_id: parent.merchant_id, // Inherit from parent
                    condition: condition,
                    price: p.price,
                    stock_quantity: p.stock || 0,
                    images: p.images || [],
                    status: 'active'
                }, { onConflict: 'product_id, condition' });

            if (offerError) {
                console.error(`      ❌ Failed to create offer: ${offerError.message}`);
                // If conflict (e.g. 2 'used' phones), strictly we skip the second one for now or we'd need distinct conditions like 'used - good'
                // For now, logging error and proceeding.
                continue;
            }

            // 2. Archive if it's NOT the parent
            if (p.id !== parent.id) {
                const { error: archiveError } = await supabase
                    .from('products')
                    .update({ status: 'archived' })
                    .eq('id', p.id);

                if (archiveError) console.error(`      ❌ Failed to archive: ${archiveError.message}`);
                else {
                    console.log(`      ✅ Archived duplicate row.`);
                    totalArchived++;
                }
            }
        }

        // 3. Update Parent flag and Name
        // Ensure parent name is clean (remove 'New' suffix if present)
        const { cleanName } = detectCondition(parent);
        const { error: updateParentError } = await supabase
            .from('products')
            .update({
                has_condition_offers: true,
                name: cleanName // Rename "iPhone 16 (New)" -> "iPhone 16"
            })
            .eq('id', parent.id);

        if (updateParentError) console.error(`   ❌ Failed to update parent: ${updateParentError.message}`);
        else console.log(`   ✅ Parent updated with flag and clean name.`);

        totalMerged++;
    }

    console.log(`\n--- Migration Complete ---`);
    console.log(`Families Merged: ${totalMerged}`);
    console.log(`Products Archived: ${totalArchived}`);
}

main().catch(console.error);
