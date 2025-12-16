import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
    description: string;
    status: string;
    category_id: string | null;
}

interface ConsolidationResult {
    baseName: string;
    parentId: string;
    parentSlug: string;
    parentName: string;
    childrenArchived: { id: string; name: string; slug: string }[];
    offersCreated: { condition: string; price: number }[];
    redirects: { oldSlug: string; newSlug: string }[];
}

type ProductCondition = 'new' | 'used' | 'open_box' | 'refurbished';

/**
 * Detect condition from product name and clean the name
 *
 * Patterns handled:
 * - "(New Open Box)" -> open_box
 * - "(Open Box)" -> open_box
 * - "(UK Used)" -> used
 * - "(Esim)" / "(Physical+Esim)" -> variant info, not condition
 */
function detectConditionFromName(name: string): { condition: ProductCondition; cleanName: string; variant?: string } {
    let condition: ProductCondition = 'new';
    let cleanName = name;
    let variant: string | undefined;

    const nameLower = name.toLowerCase();

    // Detect condition from name patterns
    if (nameLower.includes('new open box') || nameLower.includes('open box')) {
        condition = 'open_box';
    } else if (nameLower.includes('uk used') || nameLower.includes('us used') || nameLower.includes('fairly used')) {
        condition = 'used';
    } else if (nameLower.includes('refurbished') || nameLower.includes('refurb')) {
        condition = 'refurbished';
    } else if (nameLower.includes('brand new') || /\(new\)/i.test(name)) {
        condition = 'new';
    }

    // Extract variant info (Esim, Physical+Esim, etc.) before removing
    const variantMatch = name.match(/\((Esim|Physical\+Esim|Physical \+ Esim|Dual Sim)\)/i);
    if (variantMatch) {
        variant = variantMatch[1];
    }

    // Clean name - remove condition keywords and parentheses
    cleanName = cleanName
        // Remove condition keywords in parentheses
        .replace(/\s*\(New Open Box\)\s*/gi, ' ')
        .replace(/\s*\(Open Box\)\s*/gi, ' ')
        .replace(/\s*\(UK Used\)\s*/gi, ' ')
        .replace(/\s*\(US Used\)\s*/gi, ' ')
        .replace(/\s*\(Fairly Used\)\s*/gi, ' ')
        .replace(/\s*\(Used\)\s*/gi, ' ')
        .replace(/\s*\(Refurbished\)\s*/gi, ' ')
        .replace(/\s*\(Brand New\)\s*/gi, ' ')
        .replace(/\s*\(New\)\s*/gi, ' ')
        // Remove variant info (will be handled separately in future)
        .replace(/\s*\(Esim\)\s*/gi, ' ')
        .replace(/\s*\(Physical\+Esim\)\s*/gi, ' ')
        .replace(/\s*\(Physical \+ Esim\)\s*/gi, ' ')
        .replace(/\s*\(Dual Sim\)\s*/gi, ' ')
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();

    return { condition, cleanName, variant };
}

/**
 * Normalize product name for grouping
 * Removes condition, variant info, and normalizes spacing/case
 */
function normalizeProductName(name: string): string {
    const { cleanName } = detectConditionFromName(name);
    return cleanName.toLowerCase();
}

/**
 * Select the best parent product from a group
 *
 * Priority:
 * 1. Product with condition = 'new' (database field)
 * 2. Product with is_parent = true
 * 3. Product without condition keywords in name (assumed new)
 * 4. Highest price (usually most complete/quality product)
 */
function selectParent(products: Product[]): Product {
    // 1. Check for explicit 'new' condition in database
    const newCondition = products.find(p =>
        p.condition?.toLowerCase() === 'new' || p.condition?.toLowerCase() === 'brand new'
    );
    if (newCondition) return newCondition;

    // 2. Check for is_parent flag (if it existed)
    // Not currently in schema, skip

    // 3. Product without condition keywords in name (cleanest product)
    const cleanProducts = products.filter(p => {
        const nameLower = p.name.toLowerCase();
        return !nameLower.includes('open box') &&
               !nameLower.includes('used') &&
               !nameLower.includes('refurbished');
    });
    if (cleanProducts.length > 0) {
        // Sort by price desc, return highest
        return cleanProducts.sort((a, b) => b.price - a.price)[0];
    }

    // 4. Fallback: highest price
    return products.sort((a, b) => b.price - a.price)[0];
}

async function main() {
    console.log('🔍 Open Box Product Consolidation Script\n');
    console.log('Purpose: Merge condition duplicates (Open Box, UK Used) into single canonical products');
    console.log('Following Koray\'s SEO framework: One page per product, conditions as selectors\n');

    // 1. Fetch all products that might be Open Box duplicates
    const { data: products, error } = await supabase
        .from('products')
        .select('id, merchant_id, name, slug, condition, brand, price, stock, stock_quantity, images, description, status, category_id')
        .neq('status', 'archived')
        .or('name.ilike.%open box%,name.ilike.%uk used%,name.ilike.%us used%,name.ilike.%fairly used%')
        .order('name');

    if (error) {
        console.error('❌ Error fetching products:', error);
        return;
    }

    console.log(`📊 Found ${products.length} products with condition keywords in name\n`);

    if (products.length === 0) {
        console.log('✅ No Open Box/Used products found to consolidate.');
        return;
    }

    // 2. Also fetch potential parent products (clean names without condition keywords)
    // We need these to check if a "New" parent already exists
    const { data: allProducts, error: allError } = await supabase
        .from('products')
        .select('id, merchant_id, name, slug, condition, brand, price, stock, stock_quantity, images, description, status, category_id')
        .neq('status', 'archived')
        .order('name');

    if (allError) {
        console.error('❌ Error fetching all products:', allError);
        return;
    }

    // 3. Group products by normalized base name
    const groups: Record<string, Product[]> = {};

    // First, add the Open Box/Used products
    products.forEach((p: Product) => {
        const baseName = normalizeProductName(p.name);
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(p);
    });

    // Then, check if any clean products (potential parents) match these base names
    allProducts.forEach((p: Product) => {
        const nameLower = p.name.toLowerCase();
        // Skip if it's already an Open Box/Used product (already added)
        if (nameLower.includes('open box') ||
            nameLower.includes('uk used') ||
            nameLower.includes('us used') ||
            nameLower.includes('fairly used')) {
            return;
        }

        const baseName = normalizeProductName(p.name);
        // Only add if this base name group exists (has Open Box variants)
        if (groups[baseName]) {
            // Check if not already in the group
            if (!groups[baseName].find(existing => existing.id === p.id)) {
                groups[baseName].push(p);
            }
        }
    });

    console.log(`📦 Product families to process: ${Object.keys(groups).length}\n`);

    // 4. Process each group
    const results: ConsolidationResult[] = [];
    let totalOffersCreated = 0;
    let totalArchived = 0;

    for (const [baseName, family] of Object.entries(groups)) {
        if (family.length < 1) continue;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`📱 Processing: "${baseName}" (${family.length} variants)`);

        if (VERBOSE) {
            family.forEach(p => {
                const { condition } = detectConditionFromName(p.name);
                console.log(`   - [${condition}] ${p.name} (₦${p.price?.toLocaleString()})`);
            });
        }

        // Select parent
        const parent = selectParent(family);
        const { cleanName: parentCleanName } = detectConditionFromName(parent.name);

        console.log(`   🌟 Parent: ${parent.name} (${parent.id})`);
        console.log(`   📝 Clean name: ${parentCleanName}`);

        const result: ConsolidationResult = {
            baseName,
            parentId: parent.id,
            parentSlug: parent.slug,
            parentName: parentCleanName,
            childrenArchived: [],
            offersCreated: [],
            redirects: []
        };

        // Process each product in family
        for (const p of family) {
            const { condition } = detectConditionFromName(p.name);

            console.log(`   → Processing: ${p.name} as '${condition}'`);

            if (!DRY_RUN) {
                // Create offer in product_offers table
                const { error: offerError } = await supabase
                    .from('product_offers')
                    .upsert({
                        product_id: parent.id,
                        merchant_id: parent.merchant_id,
                        condition: condition,
                        price: p.price,
                        stock_quantity: p.stock_quantity || p.stock || 0,
                        images: p.images || [],
                        status: 'active'
                    }, { onConflict: 'product_id,condition' });

                if (offerError) {
                    console.error(`     ❌ Failed to create offer: ${offerError.message}`);
                    // Continue anyway - might be duplicate condition
                } else {
                    console.log(`     ✅ Created ${condition} offer (₦${p.price?.toLocaleString()})`);
                    result.offersCreated.push({ condition, price: p.price });
                    totalOffersCreated++;
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
                        result.redirects.push({ oldSlug: p.slug, newSlug: parent.slug });
                        totalArchived++;
                    }
                }
            } else {
                // Dry run - just log what would happen
                result.offersCreated.push({ condition, price: p.price });
                if (p.id !== parent.id) {
                    result.childrenArchived.push({ id: p.id, name: p.name, slug: p.slug });
                    result.redirects.push({ oldSlug: p.slug, newSlug: parent.slug });
                }
            }
        }

        // Update parent
        if (!DRY_RUN) {
            // Fix parent condition if it's wrong (e.g., 'used' should be actual detected condition)
            const { condition: parentCondition } = detectConditionFromName(parent.name);

            const { error: updateError } = await supabase
                .from('products')
                .update({
                    has_condition_offers: true,
                    name: parentCleanName, // Clean the name
                    condition: parentCondition // Fix condition field
                })
                .eq('id', parent.id);

            if (updateError) {
                console.error(`   ❌ Failed to update parent: ${updateError.message}`);
            } else {
                console.log(`   ✅ Parent updated: has_condition_offers=true, name="${parentCleanName}"`);
            }
        }

        results.push(result);
    }

    // 5. Generate report
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 CONSOLIDATION SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Product families processed: ${results.length}`);
    console.log(`Offers created: ${totalOffersCreated}`);
    console.log(`Products archived: ${totalArchived}`);
    console.log(`Redirects needed: ${results.reduce((sum, r) => sum + r.redirects.length, 0)}`);

    // Generate markdown report
    let report = `# Open Box Consolidation Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Mode:** ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n\n`;
    report += `## Summary\n\n`;
    report += `| Metric | Count |\n|--------|-------|\n`;
    report += `| Product families | ${results.length} |\n`;
    report += `| Offers created | ${totalOffersCreated} |\n`;
    report += `| Products archived | ${totalArchived} |\n`;
    report += `| Redirects needed | ${results.reduce((sum, r) => sum + r.redirects.length, 0)} |\n\n`;

    report += `## Processed Families\n\n`;
    results.forEach(r => {
        report += `### ${r.baseName}\n`;
        report += `- **Parent:** ${r.parentName} (${r.parentId})\n`;
        report += `- **Offers:** ${r.offersCreated.map(o => `${o.condition} @ ₦${o.price.toLocaleString()}`).join(', ')}\n`;
        if (r.childrenArchived.length > 0) {
            report += `- **Archived:**\n`;
            r.childrenArchived.forEach(c => {
                report += `  - ${c.name}\n`;
            });
        }
        report += '\n';
    });

    if (results.some(r => r.redirects.length > 0)) {
        report += `## URL Redirects\n\n`;
        report += `These old URLs should redirect to the canonical product:\n\n`;
        report += `| Old Slug | New Slug |\n|----------|----------|\n`;
        results.forEach(r => {
            r.redirects.forEach(redirect => {
                report += `| ${redirect.oldSlug} | ${redirect.newSlug} |\n`;
            });
        });
    }

    const reportPath = DRY_RUN ? 'OPEN_BOX_CONSOLIDATION_DRY_RUN.md' : 'OPEN_BOX_CONSOLIDATION_REPORT.md';
    fs.writeFileSync(reportPath, report);
    console.log(`\n📝 Report saved to ${reportPath}`);

    if (DRY_RUN) {
        console.log('\n💡 Run without --dry-run to execute changes');
    }
}

main().catch(console.error);
