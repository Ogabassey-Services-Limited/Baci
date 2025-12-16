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
const FIX_MODE = args.includes('--fix');
const VERBOSE = args.includes('--verbose');
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;

// Validation patterns
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
    /\bno stories\b/i,
    /\bzero wahala\b/i,
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
];

const NIGERIAN_CONTEXT = [
    /nigeria/i,
    /naira/i,
    /\u20A6/,  // ₦ symbol
    /ngn/i,
    /lagos/i,
];

const SALES_LANGUAGE = [
    /worth every/i,
    /smart money/i,
    /deserve/i,
    /superpower/i,
    /level up/i,
    /upgrade/i,
    /go crazy/i,
    /your new/i,
    /you'll love/i,
    /you go like/i,
];

interface ValidationResult {
    productId: string;
    productName: string;
    isCompliant: boolean;
    score: number; // 0-100
    issues: string[];
    metrics: {
        wordCount: number;
        h2Count: number;
        hasH2Questions: boolean;
        has40WordAnswer: boolean;
        hasNigerianContext: boolean;
        hasTrustSignals: boolean;
        hasSpecsTable: boolean;
        hasSalesLanguage: boolean;
        hasPidginLine: boolean;
        hasEmojis: boolean;
        hasPriceInNigeria: boolean;
        hasBNPL: boolean;
    };
}

// Validate a product description
function validateDescription(id: string, name: string, description: string): ValidationResult {
    const issues: string[] = [];

    // Basic metrics
    const wordCount = description.split(/\s+/).filter(w => w.length > 0).length;
    const h2Matches = description.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
    const h2Count = h2Matches.length;

    // H2 as questions
    const hasH2Questions = h2Matches.some(h2 => h2.includes('?'));
    const allH2sAreQuestions = h2Matches.every(h2 => h2.includes('?'));

    // 40-word answer check
    const paragraphAfterH2Match = description.match(/<h2[^>]*>.*?<\/h2>\s*<p[^>]*>(.*?)<\/p>/si);
    const firstParagraphWords = paragraphAfterH2Match
        ? paragraphAfterH2Match[1].replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w.length > 0).length
        : 0;
    const has40WordAnswer = firstParagraphWords >= 30 && firstParagraphWords <= 55;

    // Context checks
    const hasNigerianContext = NIGERIAN_CONTEXT.some(p => p.test(description));
    const hasTrustSignals = TRUST_SIGNALS.some(p => p.test(description));
    const hasSpecsTable = /<table[\s\S]*?<\/table>/i.test(description);
    const hasSalesLanguage = SALES_LANGUAGE.some(p => p.test(description));
    const hasPidginLine = PIDGIN_PATTERNS.some(p => p.test(description));
    const hasEmojis = /\p{Emoji}/u.test(description);

    // Specific Koray requirements
    const hasPriceInNigeria = /price in nigeria/i.test(description);
    const hasBNPL = /bnpl|zilla|month\s*[x×]\s*\d+|\/month/i.test(description);

    // Build issues list
    if (wordCount < 100) {
        issues.push(`CRITICAL: Very short content (${wordCount} words, need 200+)`);
    } else if (wordCount < 200) {
        issues.push(`WARNING: Short content (${wordCount} words, recommend 200+)`);
    }

    if (h2Count === 0) {
        issues.push('CRITICAL: No H2 structure');
    } else if (h2Count < 3) {
        issues.push(`WARNING: Only ${h2Count} H2s (need 4: Price, Worth, Specs, Why Buy)`);
    }

    if (!hasH2Questions) {
        issues.push('HIGH: H2s are not formatted as questions');
    } else if (!allH2sAreQuestions && h2Count > 0) {
        issues.push('MEDIUM: Not all H2s are questions');
    }

    if (!has40WordAnswer && wordCount > 100) {
        issues.push(`MEDIUM: First answer is ${firstParagraphWords} words (target: 35-50)`);
    }

    if (!hasNigerianContext) {
        issues.push('HIGH: Missing Nigerian context (Nigeria, Naira, Lagos)');
    }

    if (!hasPriceInNigeria && h2Count > 0) {
        issues.push('HIGH: Missing "Price in Nigeria" in H2');
    }

    if (!hasBNPL) {
        issues.push('MEDIUM: Missing BNPL mention');
    }

    if (!hasTrustSignals) {
        issues.push('MEDIUM: Missing trust signals (warranty, delivery, Ogabassey)');
    }

    if (!hasSpecsTable) {
        issues.push('MEDIUM: Missing specs table');
    }

    if (!hasSalesLanguage) {
        issues.push('LOW: Missing sales language (emotional hooks)');
    }

    if (!hasPidginLine) {
        issues.push('LOW: Missing pidgin line for personalization');
    }

    if (hasEmojis) {
        issues.push('LOW: Contains emojis (should be removed)');
    }

    // Calculate compliance score (0-100)
    let score = 100;

    // Critical issues (-30 each)
    if (wordCount < 100) score -= 30;
    if (h2Count === 0) score -= 30;

    // High priority issues (-15 each)
    if (!hasH2Questions) score -= 15;
    if (!hasNigerianContext) score -= 15;
    if (!hasPriceInNigeria) score -= 15;

    // Medium priority issues (-10 each)
    if (!has40WordAnswer) score -= 10;
    if (!hasBNPL) score -= 10;
    if (!hasTrustSignals) score -= 10;
    if (!hasSpecsTable) score -= 10;

    // Low priority issues (-5 each)
    if (!hasSalesLanguage) score -= 5;
    if (!hasPidginLine) score -= 5;
    if (hasEmojis) score -= 5;

    score = Math.max(0, score);

    const isCompliant = score >= 70 && issues.filter(i => i.startsWith('CRITICAL') || i.startsWith('HIGH')).length === 0;

    return {
        productId: id,
        productName: name,
        isCompliant,
        score,
        issues,
        metrics: {
            wordCount,
            h2Count,
            hasH2Questions,
            has40WordAnswer,
            hasNigerianContext,
            hasTrustSignals,
            hasSpecsTable,
            hasSalesLanguage,
            hasPidginLine,
            hasEmojis,
            hasPriceInNigeria,
            hasBNPL,
        },
    };
}

async function main() {
    console.log('Koray Description Validator\n');
    console.log('Validating product descriptions against Koray SEO standards...\n');

    // 1. Fetch products with descriptions
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, description')
        .eq('status', 'active')
        .not('description', 'is', null)
        .order('name');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    let toValidate = products.filter(p => p.description && p.description.trim().length > 0);

    if (LIMIT > 0) {
        toValidate = toValidate.slice(0, LIMIT);
    }

    console.log(`Validating ${toValidate.length} products with descriptions...\n`);

    // 2. Validate each product
    const results: ValidationResult[] = [];

    for (const product of toValidate) {
        const result = validateDescription(product.id, product.name, product.description);
        results.push(result);

        if (VERBOSE && !result.isCompliant) {
            console.log(`[${result.score}%] ${result.productName}`);
            result.issues.forEach(issue => console.log(`  - ${issue}`));
            console.log('');
        }
    }

    // 3. Calculate summary stats
    const compliantCount = results.filter(r => r.isCompliant).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    const byScoreRange = {
        excellent: results.filter(r => r.score >= 90).length,
        good: results.filter(r => r.score >= 70 && r.score < 90).length,
        needsWork: results.filter(r => r.score >= 50 && r.score < 70).length,
        poor: results.filter(r => r.score < 50).length,
    };

    // Issue frequency
    const issueFrequency: Record<string, number> = {};
    for (const result of results) {
        for (const issue of result.issues) {
            const key = issue.split(':')[0] + ':' + issue.split(':')[1]?.substring(0, 30);
            issueFrequency[key] = (issueFrequency[key] || 0) + 1;
        }
    }

    // 4. Print summary
    console.log('='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Validated: ${results.length}`);
    console.log(`Compliant: ${compliantCount} (${((compliantCount / results.length) * 100).toFixed(1)}%)`);
    console.log(`Average Score: ${avgScore.toFixed(1)}%`);
    console.log(`\nBy Score Range:`);
    console.log(`  Excellent (90-100): ${byScoreRange.excellent}`);
    console.log(`  Good (70-89): ${byScoreRange.good}`);
    console.log(`  Needs Work (50-69): ${byScoreRange.needsWork}`);
    console.log(`  Poor (<50): ${byScoreRange.poor}`);

    console.log(`\nMost Common Issues:`);
    const sortedIssues = Object.entries(issueFrequency).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [issue, count] of sortedIssues) {
        console.log(`  ${count}x - ${issue}`);
    }

    // 5. Generate report
    let report = `# Koray Description Validation Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Products Validated:** ${results.length}\n\n`;

    report += `## Summary\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Compliant | ${compliantCount} (${((compliantCount / results.length) * 100).toFixed(1)}%) |\n`;
    report += `| Average Score | ${avgScore.toFixed(1)}% |\n`;
    report += `| Excellent (90-100) | ${byScoreRange.excellent} |\n`;
    report += `| Good (70-89) | ${byScoreRange.good} |\n`;
    report += `| Needs Work (50-69) | ${byScoreRange.needsWork} |\n`;
    report += `| Poor (<50) | ${byScoreRange.poor} |\n\n`;

    report += `## Common Issues\n\n`;
    report += `| Issue | Count | % |\n`;
    report += `|-------|-------|---|\n`;
    for (const [issue, count] of sortedIssues) {
        report += `| ${issue} | ${count} | ${((count / results.length) * 100).toFixed(1)}% |\n`;
    }

    report += `\n## Non-Compliant Products\n\n`;
    const nonCompliant = results.filter(r => !r.isCompliant).sort((a, b) => a.score - b.score);

    report += `| Product | Score | Top Issue |\n`;
    report += `|---------|-------|----------|\n`;
    for (const r of nonCompliant.slice(0, 100)) {
        report += `| ${r.productName.substring(0, 40)} | ${r.score}% | ${r.issues[0]?.split(':')[1]?.trim() || 'N/A'} |\n`;
    }
    if (nonCompliant.length > 100) {
        report += `\n*...and ${nonCompliant.length - 100} more*\n`;
    }

    report += `\n## Compliant Products (Sample)\n\n`;
    const compliant = results.filter(r => r.isCompliant).sort((a, b) => b.score - a.score);
    report += `| Product | Score |\n`;
    report += `|---------|-------|\n`;
    for (const r of compliant.slice(0, 20)) {
        report += `| ${r.productName.substring(0, 50)} | ${r.score}% |\n`;
    }

    // 6. Save report
    const reportFile = 'KORAY_VALIDATION_REPORT.md';
    fs.writeFileSync(reportFile, report);
    console.log(`\nReport saved to ${reportFile}`);

    // Save JSON for programmatic use
    const jsonFile = 'KORAY_VALIDATION_REPORT.json';
    fs.writeFileSync(jsonFile, JSON.stringify({
        generated: new Date().toISOString(),
        summary: {
            total: results.length,
            compliant: compliantCount,
            averageScore: avgScore,
            byScoreRange,
        },
        issueFrequency,
        nonCompliant: nonCompliant.map(r => ({
            id: r.productId,
            name: r.productName,
            score: r.score,
            issues: r.issues,
        })),
    }, null, 2));
    console.log(`JSON data saved to ${jsonFile}`);

    // 7. If --fix mode, list products that need regeneration
    if (FIX_MODE) {
        console.log('\n[FIX MODE]');
        console.log('Products needing regeneration have been identified.');
        console.log('Run the following to regenerate:');
        console.log('');
        console.log('npx tsx scripts/koray-description-generator.ts --dry-run');
        console.log('');
        console.log('The generator will automatically target non-compliant descriptions.');
    }
}

main().catch(console.error);
