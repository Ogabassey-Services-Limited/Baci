import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

if (DRY_RUN) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n');
}

interface Product {
    id: string;
    merchant_id: string;
    name: string;
    slug: string;
    condition: string | null;
    brand: string | null;
    price: number;
    stock: number;
    stock_quantity: number;
    images: string[];
    status: string;
}

interface ConsolidationResult {
    baseName: string;
    parentId: string;
    parentSlug: string;
    parentName: string;
    variantsCreated: { simType: string; price: number }[];
    childrenArchived: { id: string; name: string; slug: string }[];
}

type SimType = 'esim_only' | 'physical_esim' | 'dual_physical' | 'standard';

/**
 * Detect SIM type from product name
 */
function detectSimType(name: string): { simType: SimType; cleanName: string } {
    const nameLower = name.toLowerCase();
    let simType: SimType = 'standard';
    let cleanName = name;

    if (nameLower.includes('physical + esim') || nameLower.includes('physical+esim')) {
        simType = 'physical_esim';
        cleanName = cleanName
            .replace(/\s*Physical \+ Esim\s*/gi, ' ')
            .replace(/\s*Physical\+Esim\s*/gi, ' ');
    } else if (nameLower.includes('dual physical sim') || nameLower.includes('dual physical')) {
        simType = 'dual_physical';
        cleanName = cleanName
            .replace(/\s*\(Dual Physical Sim\)\s*/gi, ' ')
            .replace(/\s*Dual Physical Sim\s*/gi, ' ')
            .replace(/\s*\(Dual Physical\)\s*/gi, ' ');
    } else if (nameLower.includes('esim')) {
        simType = 'esim_only';
        cleanName = cleanName.replace(/\s*Esim\s*/gi, ' ');
    }

    // Clean up whitespace
    cleanName = cleanName.replace(/\s+/g, ' ').trim();

    return { simType, cleanName };
}

/**
 * Normalize product name for grouping (remove SIM type info)
 */
function normalizeProductName(name: string): string {
    const { cleanName } = detectSimType(name);
    return cleanName.toLowerCase();
}

/**
 * Get human-readable SIM type label
 */
function getSimTypeLabel(simType: SimType): string {
    switch (simType) {
        case 'esim_only': return 'eSIM Only (US)';
        case 'physical_esim': return 'Physical + eSIM';
        case 'dual_physical': return 'Dual Physical SIM';
        default: return 'Standard';
    }
}

/**
 * Select the best parent product from a group
 * Priority: Physical+eSIM > Dual Physical > eSIM Only > highest price
 */
function selectParent(products: Product[]): Product {
    // 1. Prefer Physical+eSIM (most versatile for Nigerian market)
    const physicalEsim = products.find(p => {
        const { simType } = detectSimType(p.name);
        return simType === 'physical_esim';
    });
    if (physicalEsim) return physicalEsim;

    // 2. Prefer Dual Physical SIM
    const dualPhysical = products.find(p => {
        const { simType } = detectSimType(p.name);
        return simType === 'dual_physical';
    });
    if (dualPhysical) return dualPhysical;

    // 3. Fallback to highest price
    return products.sort((a, b) => b.price - a.price)[0];
}

async function main() {
    console.log('🔍 SIM Variant Consolidation Script\n');
    console.log('Purpose: Merge eSIM/Physical SIM duplicates into single products with variants');
    console.log('Following Koray\'s SEO framework: One canonical page per product\n');

    // 1. Fetch all products with SIM type variants
    const { data: products, error } = await supabase
        .from('products')
        .select('id, merchant_id, name, slug, condition, brand, price, stock, stock_quantity, images, status')
        .neq('status', 'archived')
        .or('name.ilike.%esim%,name.ilike.%dual physical%')
        .order('name');

    if (error) {
        console.error('❌ Error fetching products:', error);
        return;
    }

    console.log(`📊 Found ${products.length} products with SIM type keywords\n`);

    if (products.length === 0) {
        console.log('✅ No SIM variant products found to consolidate.');
        return;
    }

    // 2. Group products by normalized base name
    const groups: Record<string, Product[]> = {};

    products.forEach((p: Product) => {
        const baseName = normalizeProductName(p.name);
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(p);
    });

    // Filter to only groups with multiple SIM variants
    const duplicateGroups = Object.entries(groups).filter(([_, items]) => items.length > 1);

    console.log(`📦 Product families with SIM duplicates: ${duplicateGroups.length}\n`);

    if (duplicateGroups.length === 0) {
        console.log('✅ No SIM variant duplicates found to consolidate.');
        return;
    }

    // 3. Process each group
    const results: ConsolidationResult[] = [];
    let totalVariantsCreated = 0;
    let totalArchived = 0;

    for (const [baseName, family] of duplicateGroups) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📱 Processing: "${baseName}" (${family.length} SIM variants)`);

        if (VERBOSE) {
            family.forEach(p => {
                const { simType } = detectSimType(p.name);
                console.log(`   - [${getSimTypeLabel(simType)}] ${p.name} (₦${p.price?.toLocaleString()})`);
            });
        }

        // Select parent (prefer Physical+eSIM)
        const parent = selectParent(family);
        const { cleanName: parentCleanName } = detectSimType(parent.name);

        console.log(`   🌟 Parent: ${parent.name} (${parent.id})`);
        console.log(`   📝 Clean name: ${parentCleanName}`);

        const result: ConsolidationResult = {
            baseName,
            parentId: parent.id,
            parentSlug: parent.slug,
            parentName: parentCleanName,
            variantsCreated: [],
            childrenArchived: []
        };

        // Process each product in family
        for (const p of family) {
            const { simType } = detectSimType(p.name);

            console.log(`   → Processing: ${p.name} as '${getSimTypeLabel(simType)}'`);

            if (!DRY_RUN) {
                // Create variant in product_variants table
                const { error: variantError } = await supabase
                    .from('product_variants')
                    .upsert({
                        product_id: parent.id,
                        merchant_id: parent.merchant_id,
                        sim_type: simType,
                        price_override: p.price,
                        stock_quantity: p.stock_quantity || p.stock || 0,
                        images: p.images || [],
                        condition: p.condition,
                        attributes: { sim_type: getSimTypeLabel(simType) }
                    }, { onConflict: 'product_id,sim_type' });

                if (variantError) {
                    console.error(`     ❌ Failed to create variant: ${variantError.message}`);
                } else {
                    console.log(`     ✅ Created ${getSimTypeLabel(simType)} variant (₦${p.price?.toLocaleString()})`);
                    result.variantsCreated.push({ simType, price: p.price });
                    totalVariantsCreated++;
                }

                // Archive if not parent
                if (p.id !== parent.id) {
                    const { error: archiveError } = await supabase
                        .from('products')
                        .update({ status: 'archived' })
                        .eq('id', p.id);

                    if (archiveError) {
                        console.error(`     ❌ Failed to archive: ${archiveError.message}`);
                    } else {
                        console.log(`     🗄️ Archived: ${p.name}`);
                        result.childrenArchived.push({ id: p.id, name: p.name, slug: p.slug });
                        totalArchived++;
                    }
                }
            } else {
                result.variantsCreated.push({ simType, price: p.price });
                if (p.id !== parent.id) {
                    result.childrenArchived.push({ id: p.id, name: p.name, slug: p.slug });
                }
            }
        }

        // Update parent name and flag
        if (!DRY_RUN) {
            const { error: updateError } = await supabase
                .from('products')
                .update({
                    name: parentCleanName,
                    // Flag that this product has variants (could add has_sim_variants column)
                })
                .eq('id', parent.id);

            if (updateError) {
                console.error(`   ❌ Failed to update parent: ${updateError.message}`);
            } else {
                console.log(`   ✅ Parent updated: name="${parentCleanName}"`);
            }
        }

        results.push(result);
    }

    // 4. Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 CONSOLIDATION SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Product families processed: ${results.length}`);
    console.log(`Variants created: ${DRY_RUN ? results.reduce((sum, r) => sum + r.variantsCreated.length, 0) : totalVariantsCreated}`);
    console.log(`Products archived: ${DRY_RUN ? results.reduce((sum, r) => sum + r.childrenArchived.length, 0) : totalArchived}`);

    // Generate report
    let report = `# SIM Variant Consolidation Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Mode:** ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n\n`;
    report += `## Summary\n\n`;
    report += `| Metric | Count |\n|--------|-------|\n`;
    report += `| Product families | ${results.length} |\n`;
    report += `| Variants created | ${DRY_RUN ? results.reduce((sum, r) => sum + r.variantsCreated.length, 0) : totalVariantsCreated} |\n`;
    report += `| Products archived | ${DRY_RUN ? results.reduce((sum, r) => sum + r.childrenArchived.length, 0) : totalArchived} |\n\n`;

    report += `## Processed Families\n\n`;
    results.forEach(r => {
        report += `### ${r.baseName}\n`;
        report += `- **Parent:** ${r.parentName} (${r.parentId})\n`;
        report += `- **Variants:** ${r.variantsCreated.map(v => `${v.simType} @ ₦${v.price.toLocaleString()}`).join(', ')}\n`;
        if (r.childrenArchived.length > 0) {
            report += `- **Archived:**\n`;
            r.childrenArchived.forEach(c => {
                report += `  - ${c.name}\n`;
            });
        }
        report += '\n';
    });

    const reportPath = DRY_RUN ? 'SIM_VARIANT_CONSOLIDATION_DRY_RUN.md' : 'SIM_VARIANT_CONSOLIDATION_REPORT.md';
    fs.writeFileSync(reportPath, report);
    console.log(`\n📝 Report saved to ${reportPath}`);

    if (DRY_RUN) {
        console.log('\n💡 Run without --dry-run to execute changes');
    }
}

main().catch(console.error);
