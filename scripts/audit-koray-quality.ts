
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function auditKorayQuality() {
    console.log('🕵️‍♀️ Auditing Data Quality (Koray\'s Framework checks)...\n');

    let allProducts: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, description, brand, category, slug, price, metadata, images')
            .neq('status', 'archived')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Failed to fetch batch', error);
            break;
        }

        if (products.length < pageSize) {
            hasMore = false;
        }

        allProducts = [...allProducts, ...products];
        page++;
        console.log(`Fetched ${allProducts.length} products...`);
    }

    const products = allProducts;

    if (!products || products.length === 0) {
        console.error('No products found');
        return;
    }

    const report = {
        total: products.length,
        issues: [] as string[],
        warnings: [] as string[],
        brands: new Set<string>(),
        emptyDesc: 0,
        shortDesc: 0,
        duplicateDesc: 0,
        badSlugs: 0,
        missingSpecs: 0,
        missingImages: 0,
        suspiciousPrices: 0,
        allCapsNames: 0,
        shortNames: 0
    };

    const descMap = new Map<string, number>();

    for (const p of products) {
        // Brand Normalization Check
        if (p.brand) report.brands.add(p.brand);

        // 1. Name Quality
        if (p.name.length < 10) {
            report.shortNames++;
            report.issues.push(`Short Name: [${p.name}] (${p.id})`);
        }
        if (p.name === p.name.toUpperCase() && /[A-Z]/.test(p.name)) {
            report.allCapsNames++;
            // report.issues.push(`ALL CAPS Name: [${p.name}]`); // Too noisy to list all
        }

        // 2. Description Quality (Content Thinness)
        if (!p.description || p.description.trim() === '') {
            report.emptyDesc++;
        } else if (p.description.length < 50) {
            report.shortDesc++;
        } else {
            // Check for potential duplicate content
            const descStart = p.description.substring(0, 50); // Just check start for speed
            descMap.set(descStart, (descMap.get(descStart) || 0) + 1);
        }

        // 3. Slug Quality (URL Structure)
        // Koray hates UUIDs or ID-based URLs. Should be readable.
        if (p.slug && /[0-9a-f]{8}-[0-9a-f]{4}/.test(p.slug)) {
            report.badSlugs++;
            // report.warnings.push(`Slug contains UUID: ${p.slug}`);
        }

        // 4. Missing Specs (EAV Gap)
        const hasMeta = p.metadata && Object.keys(p.metadata).length > 0;
        if (!hasMeta) {
            report.missingSpecs++;
        }

        // 5. Image Quality
        if (!p.images || p.images.length === 0) {
            report.missingImages++;
        }

        // 6. Pricing Anomalies
        if (p.price === 0 || p.price === null) {
            report.suspiciousPrices++;
            report.issues.push(`Zero/Null Price: ${p.name}`);
        }
    }

    // Analyzing Duplicates
    let exactDupes = 0;
    for (const count of descMap.values()) {
        if (count > 1) exactDupes += (count - 1);
    }
    report.duplicateDesc = exactDupes;

    // --- REPORT OUTPUT ---
    console.log(`📊 Audit Report (${report.total} Active Products)\n`);

    console.log('🔴 CRITICAL ISSUES (Must Fix for Ranking):');
    console.log(`- Missing Specifications (Empty Knowledge Graph): ${report.missingSpecs} products`);
    console.log(`- Empty Descriptions (Thin Content): ${report.emptyDesc} products`);
    console.log(`- Duplicate Descriptions (Internal Cannibalization): ~${report.duplicateDesc} instances`);
    console.log(`- Suspicious Prices (Zero/Null): ${report.suspiciousPrices} products`);
    console.log(`- Missing Images: ${report.missingImages} products`);

    console.log('\n🟡 WARNINGS (Quality Signals):');
    console.log(`- ALL CAPS Names (Low Trust Signal): ${report.allCapsNames} products`);
    console.log(`- Very Short Names (<10 chars): ${report.shortNames} products`);
    console.log(`- Short Descriptions (<50 chars): ${report.shortDesc} products`);
    console.log(`- Slugs with UUIDs (Bad URL Structure): ${report.badSlugs} products`);

    console.log('\n🔵 Brand Consistency (Check for duplicates like "Apple" vs "Apple Inc"):');
    const sortedBrands = Array.from(report.brands).sort();
    console.log(sortedBrands.join(', '));
}

auditKorayQuality().catch(console.error);
