/**
 * Bulk Product Consolidation Script
 * 
 * Processes the product_variants_report.md and consolidates:
 * 1. Condition duplicates → Single parent + product_offers
 * 2. Platform duplicates → Single parent + product_variants
 * 
 * Usage: npx tsx scripts/bulk-consolidate.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes('--dry-run');

interface ConsolidationSet {
    name: string;
    type: 'condition' | 'platform' | 'unclear';
    products: {
        id: string;
        condition: string;
        conditionDetail: string;
        price: number;
        platform?: string;
    }[];
}

/**
 * Parse the markdown report into structured data
 */
function parseReport(filePath: string): ConsolidationSet[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const sets: ConsolidationSet[] = [];
    let currentSet: ConsolidationSet | null = null;
    let currentType: 'condition' | 'platform' | 'unclear' = 'unclear';

    for (const line of lines) {
        // Detect section type
        if (line.includes('🟢 Condition Consolidation')) {
            currentType = 'condition';
            continue;
        }
        if (line.includes('⚠️ Potential Exact Duplicates')) {
            currentType = 'platform'; // Treat unclear as potential platform variants
            continue;
        }

        // Detect new product set (###)
        if (line.startsWith('### ')) {
            if (currentSet && currentSet.products.length > 0) {
                sets.push(currentSet);
            }
            currentSet = {
                name: line.replace('### ', '').trim(),
                type: currentType,
                products: [],
            };
            continue;
        }

        // Parse table rows for condition sets
        if (currentType === 'condition' && line.startsWith('|') && line.includes('`')) {
            // Format: | new (New) | ₦858,100 | `uuid` | [Link](url) |
            const match = line.match(/\|\s*(\w+)\s+\(([^)]+)\)\s*\|\s*₦?([\d,]+)\s*\|\s*`([^`]+)`/);
            if (match && currentSet) {
                currentSet.products.push({
                    id: match[4],
                    condition: match[1].toLowerCase(), // 'new', 'used'
                    conditionDetail: match[2], // 'New', 'Premium Used', etc.
                    price: parseInt(match[3].replace(/,/g, '')),
                });
            }
            continue;
        }

        // Parse table rows for platform/unclear sets
        if (currentType === 'platform' && line.startsWith('|') && line.includes('`')) {
            // Format: | ₦30,500 | new | `uuid` | unknown |
            const match = line.match(/\|\s*₦?([\d,]+)\s*\|\s*(\w+)\s*\|\s*`([^`]+)`\s*\|\s*(\w+)/);
            if (match && currentSet) {
                currentSet.products.push({
                    id: match[3],
                    condition: match[2].toLowerCase(),
                    conditionDetail: match[2],
                    price: parseInt(match[1].replace(/,/g, '')),
                    platform: match[4] === 'unknown' ? undefined : match[4],
                });
            }
        }
    }

    // Push last set
    if (currentSet && currentSet.products.length > 0) {
        sets.push(currentSet);
    }

    return sets;
}

/**
 * Consolidate a condition-based duplicate set
 */
async function consolidateConditionSet(set: ConsolidationSet): Promise<boolean> {
    console.log(`\n📦 Processing: ${set.name} (${set.products.length} conditions)`);

    // Find the "new" product to be the parent, or the first one
    const parentProduct = set.products.find(p => p.condition === 'new') || set.products[0];
    const childProducts = set.products.filter(p => p.id !== parentProduct.id);

    if (childProducts.length === 0) {
        console.log('  ⚠️ Only one product, skipping');
        return false;
    }

    // Fetch parent product details (include archived to handle previous migrations)
    const { data: parent, error: parentError } = await supabase
        .from('products')
        .select('id, name, slug, merchant_id, images, status')
        .eq('id', parentProduct.id)
        .maybeSingle();

    if (parentError || !parent) {
        console.log(`  ❌ Parent not found: ${parentProduct.id} - Error: ${parentError?.message || 'No data'}`);
        return false;
    }

    // If parent is archived, we need to decide what to do
    if (parent.status === 'archived') {
        console.log(`  ⚠️ Parent is archived, reactivating: ${parent.name}`);
        if (!DRY_RUN) {
            await supabase.from('products').update({ status: 'active' }).eq('id', parent.id);
        }
    }

    if (DRY_RUN) {
        console.log(`  🔍 [DRY RUN] Would consolidate into parent: ${parent.name}`);
        for (const child of childProducts) {
            console.log(`     - Archive ${child.id} (${child.conditionDetail})`);
        }
        return true;
    }

    // Create product_offers for each condition
    const offers = set.products.map(p => ({
        product_id: parent.id,
        merchant_id: parent.merchant_id,
        condition: p.condition as 'new' | 'used' | 'open_box' | 'refurbished',
        condition_detail: p.conditionDetail,
        price: p.price,
        stock_quantity: 10, // Default stock
        images: [], // Could fetch from original if needed
        is_active: true,
    }));

    // Insert offers
    const { error: offersError } = await supabase
        .from('product_offers')
        .upsert(offers, { onConflict: 'product_id,condition' });

    if (offersError) {
        console.log(`  ❌ Failed to create offers: ${offersError.message}`);
        return false;
    }

    // Update parent to have has_condition_offers = true
    const { error: updateError } = await supabase
        .from('products')
        .update({ has_condition_offers: true })
        .eq('id', parent.id);

    if (updateError) {
        console.log(`  ❌ Failed to update parent: ${updateError.message}`);
        return false;
    }

    // Archive child products (set status to 'archived')
    const childIds = childProducts.map(p => p.id);
    const { error: archiveError } = await supabase
        .from('products')
        .update({ status: 'archived' })
        .in('id', childIds);

    if (archiveError) {
        console.log(`  ❌ Failed to archive children: ${archiveError.message}`);
        return false;
    }

    console.log(`  ✅ Consolidated! Parent: ${parent.id}, Archived: ${childIds.length} products`);
    return true;
}

/**
 * Handle platform duplicates (e.g., Nintendo vs PlayStation)
 * These might need to be kept separate with platform tags
 */
async function handlePlatformSet(set: ConsolidationSet): Promise<boolean> {
    console.log(`\n🎮 Processing: ${set.name} (${set.products.length} potential duplicates)`);

    // Check if any have platform hints
    const withPlatform = set.products.filter(p => p.platform);

    if (withPlatform.length > 0) {
        // These are platform variants - skip for now, need human review
        console.log(`  ⚠️ Has platform hints, skipping (needs manual review)`);
        return false;
    }

    // These are true duplicates - keep the lowest-priced one
    const sorted = [...set.products].sort((a, b) => a.price - b.price);
    const keep = sorted[0];
    const archive = sorted.slice(1);

    if (DRY_RUN) {
        console.log(`  🔍 [DRY RUN] Would keep: ${keep.id} (₦${keep.price.toLocaleString()})`);
        for (const p of archive) {
            console.log(`     - Archive ${p.id} (₦${p.price.toLocaleString()})`);
        }
        return true;
    }

    // Archive duplicates
    const archiveIds = archive.map(p => p.id);
    const { error } = await supabase
        .from('products')
        .update({ status: 'archived' })
        .in('id', archiveIds);

    if (error) {
        console.log(`  ❌ Failed to archive: ${error.message}`);
        return false;
    }

    console.log(`  ✅ Kept ${keep.id}, Archived ${archiveIds.length} duplicates`);
    return true;
}

/**
 * Main execution
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('       BULK PRODUCT CONSOLIDATION');
    console.log(DRY_RUN ? '       🔍 DRY RUN MODE - No changes will be made' : '       ⚡ LIVE MODE - Changes will be applied');
    console.log('═══════════════════════════════════════════════════════════');

    const reportPath = path.join(process.cwd(), 'product_variants_report.md');

    if (!fs.existsSync(reportPath)) {
        console.error('❌ Report file not found:', reportPath);
        process.exit(1);
    }

    const sets = parseReport(reportPath);
    console.log(`\n📊 Parsed ${sets.length} consolidation sets`);

    const conditionSets = sets.filter(s => s.type === 'condition');
    const platformSets = sets.filter(s => s.type === 'platform');

    console.log(`   - Condition-based: ${conditionSets.length}`);
    console.log(`   - Platform/Unclear: ${platformSets.length}`);

    let successCount = 0;
    let failCount = 0;

    // Process condition sets
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PHASE 1: Condition-Based Consolidation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const set of conditionSets) {
        try {
            const success = await consolidateConditionSet(set);
            if (success) successCount++;
            else failCount++;
        } catch (err) {
            console.log(`  ❌ Error: ${err}`);
            failCount++;
        }
    }

    // Process platform sets (more carefully)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PHASE 2: Platform/Unclear Duplicates');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const set of platformSets) {
        try {
            const success = await handlePlatformSet(set);
            if (success) successCount++;
            else failCount++;
        } catch (err) {
            console.log(`  ❌ Error: ${err}`);
            failCount++;
        }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed/Skipped: ${failCount}`);
    console.log(`📊 Total Processed: ${sets.length}`);

    if (DRY_RUN) {
        console.log('\n💡 Run without --dry-run to apply changes');
    }
}

main().catch(console.error);
