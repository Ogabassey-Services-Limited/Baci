
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function auditDescriptions() {
    console.log('🔍 Starting Correlation-Based Description Audit (Koray\'s Framework)...\n');

    // Fetch all products with pagination
    let products: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, description, category, brand')
            .neq('status', 'archived')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching products:', error);
            return;
        }

        if (!data || data.length === 0) break;
        products = products.concat(data);

        if (data.length < pageSize) break;
        page++;
    }

    console.log(`Analyzing ${products.length} active products...\n`);

    let stats = {
        total: products.length,
        thinContent: 0, // < 50 words
        noStructure: 0, // No Headers
        missingContext: 0, // No local trust signals
        missingEAV: 0, // No specific numbers/specs
        goodQuality: 0,
        manufacturerGeneric: 0 // Contains generic fluff
    };

    const weakProducts: any[] = [];
    const genericfluffPatterns = [
        /limitless possibilities/i,
        /perfect companion/i,
        /stunning design/i,
        /revolutionary/i,
        /game changer/i
    ];

    const localContextKeywords = [
        'warranty',
        'delivery',
        'lagos',
        'nationwide',
        'payment',
        'installment',
        'zilla',
        'store',
        'shipping',
        'naira',
        '₦'
    ];

    for (const p of products) {
        const desc = p.description || '';
        const wordCount = desc.split(/\s+/).length;

        // Check 1: Thin Content
        const isThin = wordCount < 50;

        // Check 2: Structure (Markdown headers or HTML h tags)
        const hasStructure = /#{2,}|<h[1-6]>/i.test(desc);

        // Check 3: Local Context
        const hasContext = localContextKeywords.some(k => desc.toLowerCase().includes(k));

        // Check 4: EAV Signals (Contains numbers describing specs like 5000mAh, 128GB, 6.7")
        // We look for Number followed by letters (e.g. 5G, 12MP, 5000mAh)
        const hasEAV = /\d+\s*[a-zA-Z%]+/.test(desc);

        // Check 5: Generic Fluff
        const hasFluff = genericfluffPatterns.some(pattern => pattern.test(desc));

        const issues = [];
        if (isThin) {
            stats.thinContent++;
            issues.push('Thin Content (<50 words)');
        }
        if (!hasStructure && wordCount > 50) { // Only penalize structure if it's long enough to need it
            stats.noStructure++;
            issues.push('No Heading Structure');
        }
        if (!hasContext) {
            stats.missingContext++;
            issues.push('Missing Local Context');
        }
        if (!hasEAV) {
            stats.missingEAV++;
            issues.push('Missing EAV/Specs');
        }
        if (hasFluff) {
            stats.manufacturerGeneric++;
            issues.push('Generic/Marketing Fluff');
        }

        if (issues.length === 0) {
            stats.goodQuality++;
        } else {
            weakProducts.push({
                name: p.name,
                category: p.category,
                brand: p.brand,
                descPreview: desc.substring(0, 60).replace(/\n/g, ' ') + '...',
                issues
            });
        }
    }

    const report = [
        '📊 Audit Results:',
        '-----------------------------------',
        `Total Products: ${stats.total}`,
        `✅ Good Quality (Passes all checks): ${stats.goodQuality} (${((stats.goodQuality / stats.total) * 100).toFixed(1)}%)`,
        `⚠️  Thin Content (<50 words): ${stats.thinContent}`,
        `⚠️  No Heading Structure: ${stats.noStructure}`,
        `⚠️  Missing Local Context (Warranty/Delivery): ${stats.missingContext}`,
        `⚠️  Missing EAV Signals (Specs/Numbers): ${stats.missingEAV}`,
        `⚠️  Generic Marketing Fluff: ${stats.manufacturerGeneric}`,
        '',
        '🔍 Sample Weak Products (Top 10):'
    ].join('\n');

    console.log(report);

    const detailedReport = [report];
    weakProducts.slice(0, 10).forEach(p => {
        detailedReport.push(`\n- [${p.brand}] ${p.name}`);
        detailedReport.push(`  Issues: ${p.issues.join(', ')}`);
        detailedReport.push(`  Preview: ${p.descPreview}`);
    });

    // Category breakdown of thin content
    console.log('\n📉 Thin Content by Category (Top 5):');
    const thinByCategory: Record<string, number> = {};
    weakProducts.filter(p => p.issues.includes('Thin Content (<50 words)')).forEach(p => {
        thinByCategory[p.category] = (thinByCategory[p.category] || 0) + 1;
    });

    Object.entries(thinByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([cat, count]) => {
            console.log(`  - ${cat}: ${count}`);
        });
}

auditDescriptions();
