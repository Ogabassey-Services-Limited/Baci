import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse CLI arguments
const args = process.argv.slice(2);
const outputArg = args.find(a => a.startsWith('--output='));
const OUTPUT_FILE = outputArg ? outputArg.split('=')[1] : 'KORAY_AUDIT_REPORT.md';
const VERBOSE = args.includes('--verbose');

// Koray validation patterns
const PIDGIN_PATTERNS = [
    /\bno wahala\b/i,
    /\be no get\b/i,
    /\bna correct\b/i,
    /\bwe dey\b/i,
    /\byou go like\b/i,
    /\bthis one na\b/i,
    /\bomo,?\b/i,
    /\bno dey play\b/i,
    /\bpass this one\b/i,
    /\bsharp sharp\b/i,
    /\bwetin\b/i,
    /\bnaija\b/i,
];

const TRUST_SIGNALS = [
    /warranty/i,
    /delivery/i,
    /bnpl/i,
    /zilla/i,
    /ogabassey/i,
    /official/i,
    /sealed/i,
    /nationwide/i,
    /lagos/i,
];

const NIGERIAN_CONTEXT = [
    /nigeria/i,
    /naira/i,
    /\u20A6/,  // ₦ symbol
    /ngn/i,
    /lagos/i,
    /abuja/i,
];

interface Product {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    brand: string | null;
    category_id: string | null;
    category_slug?: string;
    category_name?: string;
    status: string;
}

interface ValidationResult {
    productId: string;
    productName: string;
    productSlug: string;
    categoryName: string;
    price: number;
    violations: string[];
    metrics: {
        wordCount: number;
        hasH2Questions: boolean;
        has40WordAnswer: boolean;
        hasNigerianContext: boolean;
        hasTrustSignals: boolean;
        hasSpecsTable: boolean;
        hasPidginLine: boolean;
        hasEmojis: boolean;
    };
}

interface CategorySummary {
    name: string;
    total: number;
    violations: {
        noDescription: number;
        thinContent: number;
        noH2Structure: number;
        noNigerianContext: number;
        noTrustSignals: number;
        noSpecsTable: number;
        noPidgin: number;
        hasEmojis: number;
    };
}

// Validate a single product description
function validateDescription(product: Product): ValidationResult {
    const description = product.description || '';
    const violations: string[] = [];

    // Calculate word count
    const wordCount = description.split(/\s+/).filter(w => w.length > 0).length;

    // Check for H2 questions
    const h2Matches = description.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
    const hasH2Questions = h2Matches.some(h2 => h2.includes('?'));

    // Check for 40-word answer (first paragraph after H2)
    const paragraphAfterH2 = description.match(/<h2[^>]*>.*?<\/h2>\s*<p[^>]*>(.*?)<\/p>/si);
    const firstParagraphWords = paragraphAfterH2
        ? paragraphAfterH2[1].replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w.length > 0).length
        : 0;
    const has40WordAnswer = firstParagraphWords >= 35 && firstParagraphWords <= 50;

    // Check Nigerian context
    const hasNigerianContext = NIGERIAN_CONTEXT.some(pattern => pattern.test(description));

    // Check trust signals
    const hasTrustSignals = TRUST_SIGNALS.some(pattern => pattern.test(description));

    // Check specs table
    const hasSpecsTable = /<table[\s\S]*?<\/table>/i.test(description);

    // Check pidgin
    const hasPidginLine = PIDGIN_PATTERNS.some(pattern => pattern.test(description));

    // Check emojis
    const hasEmojis = /\p{Emoji}/u.test(description);

    // Build violations list
    if (!description || description.trim().length === 0) {
        violations.push('NO_DESCRIPTION');
    } else if (wordCount < 50) {
        violations.push('THIN_CONTENT');
    } else if (wordCount < 200) {
        violations.push('SHORT_CONTENT');
    }

    if (description && !hasH2Questions && h2Matches.length === 0) {
        violations.push('NO_H2_STRUCTURE');
    } else if (description && h2Matches.length > 0 && !hasH2Questions) {
        violations.push('H2_NOT_QUESTIONS');
    }

    if (description && wordCount > 50 && !has40WordAnswer) {
        violations.push('NO_40_WORD_ANSWER');
    }

    if (description && wordCount > 50 && !hasNigerianContext) {
        violations.push('NO_NIGERIAN_CONTEXT');
    }

    if (description && wordCount > 50 && !hasTrustSignals) {
        violations.push('NO_TRUST_SIGNALS');
    }

    if (description && wordCount > 50 && !hasSpecsTable) {
        violations.push('NO_SPECS_TABLE');
    }

    if (description && wordCount > 50 && !hasPidginLine) {
        violations.push('NO_PIDGIN_LINE');
    }

    if (hasEmojis) {
        violations.push('HAS_EMOJIS');
    }

    return {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        categoryName: product.category_name || 'Unknown',
        price: product.price,
        violations,
        metrics: {
            wordCount,
            hasH2Questions,
            has40WordAnswer,
            hasNigerianContext,
            hasTrustSignals,
            hasSpecsTable,
            hasPidginLine,
            hasEmojis,
        },
    };
}

async function main() {
    console.log('Koray Product Description Audit\n');
    console.log('Auditing ALL active products for Koray SEO compliance...\n');

    // 1. Fetch all active products with category info
    const { data: products, error } = await supabase
        .from('products')
        .select(`
            id,
            name,
            slug,
            description,
            price,
            brand,
            category_id,
            status,
            categories!inner(name, slug)
        `)
        .eq('status', 'active')
        .order('name');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    // Transform to include category info
    const productsWithCategory: Product[] = products.map((p: any) => ({
        ...p,
        category_name: p.categories?.name || 'Unknown',
        category_slug: p.categories?.slug || 'unknown',
    }));

    console.log(`Found ${productsWithCategory.length} active products\n`);

    // 2. Validate each product
    const results: ValidationResult[] = [];
    const categoryMap: Map<string, CategorySummary> = new Map();

    for (const product of productsWithCategory) {
        const result = validateDescription(product);
        results.push(result);

        // Update category summary
        const catName = product.category_name || 'Unknown';
        if (!categoryMap.has(catName)) {
            categoryMap.set(catName, {
                name: catName,
                total: 0,
                violations: {
                    noDescription: 0,
                    thinContent: 0,
                    noH2Structure: 0,
                    noNigerianContext: 0,
                    noTrustSignals: 0,
                    noSpecsTable: 0,
                    noPidgin: 0,
                    hasEmojis: 0,
                },
            });
        }

        const cat = categoryMap.get(catName)!;
        cat.total++;

        if (result.violations.includes('NO_DESCRIPTION')) cat.violations.noDescription++;
        if (result.violations.includes('THIN_CONTENT') || result.violations.includes('SHORT_CONTENT')) cat.violations.thinContent++;
        if (result.violations.includes('NO_H2_STRUCTURE') || result.violations.includes('H2_NOT_QUESTIONS')) cat.violations.noH2Structure++;
        if (result.violations.includes('NO_NIGERIAN_CONTEXT')) cat.violations.noNigerianContext++;
        if (result.violations.includes('NO_TRUST_SIGNALS')) cat.violations.noTrustSignals++;
        if (result.violations.includes('NO_SPECS_TABLE')) cat.violations.noSpecsTable++;
        if (result.violations.includes('NO_PIDGIN_LINE')) cat.violations.noPidgin++;
        if (result.violations.includes('HAS_EMOJIS')) cat.violations.hasEmojis++;
    }

    // 3. Calculate totals
    const totals = {
        total: results.length,
        compliant: results.filter(r => r.violations.length === 0).length,
        noDescription: results.filter(r => r.violations.includes('NO_DESCRIPTION')).length,
        thinContent: results.filter(r => r.violations.includes('THIN_CONTENT') || r.violations.includes('SHORT_CONTENT')).length,
        noH2Structure: results.filter(r => r.violations.includes('NO_H2_STRUCTURE') || r.violations.includes('H2_NOT_QUESTIONS')).length,
        noNigerianContext: results.filter(r => r.violations.includes('NO_NIGERIAN_CONTEXT')).length,
        noTrustSignals: results.filter(r => r.violations.includes('NO_TRUST_SIGNALS')).length,
        noSpecsTable: results.filter(r => r.violations.includes('NO_SPECS_TABLE')).length,
        noPidgin: results.filter(r => r.violations.includes('NO_PIDGIN_LINE')).length,
        hasEmojis: results.filter(r => r.violations.includes('HAS_EMOJIS')).length,
    };

    // 4. Print summary to console
    console.log('=' .repeat(60));
    console.log('AUDIT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Products: ${totals.total}`);
    console.log(`Fully Compliant: ${totals.compliant} (${((totals.compliant / totals.total) * 100).toFixed(1)}%)`);
    console.log(`\nVIOLATIONS:`);
    console.log(`  No Description: ${totals.noDescription}`);
    console.log(`  Thin Content (<200 words): ${totals.thinContent}`);
    console.log(`  No H2 Structure: ${totals.noH2Structure}`);
    console.log(`  No Nigerian Context: ${totals.noNigerianContext}`);
    console.log(`  No Trust Signals: ${totals.noTrustSignals}`);
    console.log(`  No Specs Table: ${totals.noSpecsTable}`);
    console.log(`  No Pidgin Line: ${totals.noPidgin}`);
    console.log(`  Has Emojis: ${totals.hasEmojis}`);

    // 5. Generate markdown report
    let report = `# Koray Product Description Audit Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Products Audited:** ${totals.total}\n\n`;

    report += `## Executive Summary\n\n`;
    report += `| Metric | Count | Percentage |\n`;
    report += `|--------|-------|------------|\n`;
    report += `| **Fully Compliant** | ${totals.compliant} | ${((totals.compliant / totals.total) * 100).toFixed(1)}% |\n`;
    report += `| **Needs Work** | ${totals.total - totals.compliant} | ${(((totals.total - totals.compliant) / totals.total) * 100).toFixed(1)}% |\n\n`;

    report += `## Violations Breakdown\n\n`;
    report += `| Violation Type | Count | % of Total | Priority |\n`;
    report += `|----------------|-------|------------|----------|\n`;
    report += `| No Description | ${totals.noDescription} | ${((totals.noDescription / totals.total) * 100).toFixed(1)}% | CRITICAL |\n`;
    report += `| Thin Content | ${totals.thinContent} | ${((totals.thinContent / totals.total) * 100).toFixed(1)}% | HIGH |\n`;
    report += `| No H2 Structure | ${totals.noH2Structure} | ${((totals.noH2Structure / totals.total) * 100).toFixed(1)}% | HIGH |\n`;
    report += `| No Nigerian Context | ${totals.noNigerianContext} | ${((totals.noNigerianContext / totals.total) * 100).toFixed(1)}% | MEDIUM |\n`;
    report += `| No Trust Signals | ${totals.noTrustSignals} | ${((totals.noTrustSignals / totals.total) * 100).toFixed(1)}% | MEDIUM |\n`;
    report += `| No Specs Table | ${totals.noSpecsTable} | ${((totals.noSpecsTable / totals.total) * 100).toFixed(1)}% | MEDIUM |\n`;
    report += `| No Pidgin Line | ${totals.noPidgin} | ${((totals.noPidgin / totals.total) * 100).toFixed(1)}% | LOW |\n`;
    report += `| Has Emojis | ${totals.hasEmojis} | ${((totals.hasEmojis / totals.total) * 100).toFixed(1)}% | LOW |\n\n`;

    report += `## By Category\n\n`;

    // Sort categories by total products descending
    const sortedCategories = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

    report += `| Category | Total | No Desc | Thin | No H2 | No NG Context | No Trust | No Table | No Pidgin |\n`;
    report += `|----------|-------|---------|------|-------|---------------|----------|----------|----------|\n`;

    for (const cat of sortedCategories) {
        report += `| ${cat.name} | ${cat.total} | ${cat.violations.noDescription} | ${cat.violations.thinContent} | ${cat.violations.noH2Structure} | ${cat.violations.noNigerianContext} | ${cat.violations.noTrustSignals} | ${cat.violations.noSpecsTable} | ${cat.violations.noPidgin} |\n`;
    }

    report += `\n## Critical Issues (No Description)\n\n`;
    const noDescProducts = results.filter(r => r.violations.includes('NO_DESCRIPTION'));
    if (noDescProducts.length > 0) {
        report += `| Product | Category | Price |\n`;
        report += `|---------|----------|-------|\n`;
        for (const p of noDescProducts.slice(0, 50)) {
            report += `| ${p.productName} | ${p.categoryName} | ${p.price.toLocaleString()} |\n`;
        }
        if (noDescProducts.length > 50) {
            report += `\n*...and ${noDescProducts.length - 50} more*\n`;
        }
    } else {
        report += `*No products without descriptions*\n`;
    }

    report += `\n## Thin Content Issues (<200 words)\n\n`;
    const thinProducts = results.filter(r => r.violations.includes('THIN_CONTENT') || r.violations.includes('SHORT_CONTENT'));
    if (thinProducts.length > 0) {
        report += `| Product | Category | Word Count |\n`;
        report += `|---------|----------|------------|\n`;
        for (const p of thinProducts.slice(0, 50)) {
            report += `| ${p.productName} | ${p.categoryName} | ${p.metrics.wordCount} |\n`;
        }
        if (thinProducts.length > 50) {
            report += `\n*...and ${thinProducts.length - 50} more*\n`;
        }
    } else {
        report += `*No thin content issues*\n`;
    }

    report += `\n## Koray Compliance Checklist\n\n`;
    report += `The Four Pillars for every product description:\n\n`;
    report += `1. **KORAY SEO STRUCTURE**\n`;
    report += `   - [ ] H2s formatted as questions\n`;
    report += `   - [ ] 40-word extractive answers\n`;
    report += `   - [ ] EAV format (not adjectives)\n`;
    report += `   - [ ] Specs table present\n\n`;
    report += `2. **SALESMANSHIP**\n`;
    report += `   - [ ] Emotional hooks\n`;
    report += `   - [ ] Benefits over features\n`;
    report += `   - [ ] Nigerian voice\n\n`;
    report += `3. **SEARCH RELEVANCE**\n`;
    report += `   - [ ] "Price in Nigeria" keyword\n`;
    report += `   - [ ] Price + BNPL mentioned\n`;
    report += `   - [ ] Local trust signals\n\n`;
    report += `4. **PERSONALIZATION**\n`;
    report += `   - [ ] ONE pidgin line\n`;
    report += `   - [ ] No emojis\n`;
    report += `   - [ ] Authentic voice\n\n`;

    report += `## Next Steps\n\n`;
    report += `1. Run \`npx tsx scripts/koray-description-generator.ts --category=smartphones --dry-run\`\n`;
    report += `2. Review generated descriptions\n`;
    report += `3. Run without --dry-run to apply\n`;
    report += `4. Re-run this audit to verify\n`;

    // 6. Save report
    fs.writeFileSync(OUTPUT_FILE, report);
    console.log(`\nReport saved to ${OUTPUT_FILE}`);

    // 7. Also save JSON for programmatic use
    const jsonReport = {
        generated: new Date().toISOString(),
        totals,
        categories: sortedCategories,
        violations: {
            noDescription: noDescProducts.map(p => ({ id: p.productId, name: p.productName })),
            thinContent: thinProducts.map(p => ({ id: p.productId, name: p.productName, wordCount: p.metrics.wordCount })),
        },
    };

    fs.writeFileSync(OUTPUT_FILE.replace('.md', '.json'), JSON.stringify(jsonReport, null, 2));
    console.log(`JSON data saved to ${OUTPUT_FILE.replace('.md', '.json')}`);
}

main().catch(console.error);
