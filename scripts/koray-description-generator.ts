import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
import { getBatchPrompt, getProductPrompt, getCategoryPrompt } from './koray-prompt-template';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GOOGLE_GENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

if (!geminiApiKey) {
    console.error('Missing GOOGLE_GENAI_API_KEY environment variable');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

// Parse CLI arguments
const args = process.argv.slice(2);
const categoryArg = args.find(a => a.startsWith('--category='));
const CATEGORY = categoryArg ? categoryArg.split('=')[1] : null;
const DRY_RUN = args.includes('--dry-run');
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;
const BATCH_SIZE = 5; // Products per API request
const VERBOSE = args.includes('--verbose');

if (DRY_RUN) {
    console.log('DRY RUN MODE - No changes will be made to the database\n');
}

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
    specifications?: Record<string, any>;
}

interface GenerationResult {
    productId: string;
    productName: string;
    success: boolean;
    description?: string;
    error?: string;
}

// Rate limiting helper
async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract specs from product
function extractSpecs(product: Product): Record<string, string> {
    const specs: Record<string, string> = {};

    if (product.specifications) {
        // Flatten nested specifications
        const flattenSpecs = (obj: any, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenSpecs(value, `${prefix}${key}_`);
                } else {
                    specs[`${prefix}${key}`] = String(value);
                }
            }
        };
        flattenSpecs(product.specifications);
    }

    return specs;
}

// Generate description for a single product using Gemini
async function generateSingleDescription(product: Product): Promise<GenerationResult> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = getProductPrompt({
            name: product.name,
            price: product.price,
            brand: product.brand || undefined,
            category: product.category_name || undefined,
            specs: extractSpecs(product),
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean up response - remove markdown code blocks if present
        text = text.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

        // Basic validation
        if (!text.includes('<h2>') || !text.includes('</h2>')) {
            throw new Error('Generated content missing H2 structure');
        }

        return {
            productId: product.id,
            productName: product.name,
            success: true,
            description: text,
        };
    } catch (error: any) {
        return {
            productId: product.id,
            productName: product.name,
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

// Generate descriptions for a batch of products
async function generateBatchDescriptions(products: Product[]): Promise<GenerationResult[]> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = getBatchPrompt(products.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            brand: p.brand || undefined,
            category: p.category_name || undefined,
            specs: extractSpecs(p),
        })));

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('No JSON array found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return parsed.map((item: { id: string; description: string }) => {
            const product = products.find(p => p.id === item.id);
            return {
                productId: item.id,
                productName: product?.name || 'Unknown',
                success: true,
                description: item.description,
            };
        });
    } catch (error: any) {
        console.error('Batch generation failed, falling back to individual:', error.message);
        // Fallback to individual generation
        const results: GenerationResult[] = [];
        for (const product of products) {
            const result = await generateSingleDescription(product);
            results.push(result);
            await sleep(3000); // Rate limit
        }
        return results;
    }
}

// Map category slugs to groups
function getCategoryGroup(categorySlug: string): string {
    const mapping: Record<string, string> = {
        'smartphones': 'smartphones',
        'phones': 'smartphones',
        'mobile-phones': 'smartphones',
        'iphones': 'smartphones',
        'samsung-phones': 'smartphones',
        'laptops': 'laptops',
        'macbooks': 'laptops',
        'chromebooks': 'laptops',
        'gaming-laptops': 'laptops',
        'gaming': 'gaming',
        'games': 'gaming',
        'playstation': 'gaming',
        'ps5': 'gaming',
        'ps4': 'gaming',
        'xbox': 'gaming',
        'nintendo': 'gaming',
        'switch': 'gaming',
        'gaming-accessories': 'gaming',
        'tablets': 'tablets',
        'ipads': 'tablets',
        'accessories': 'others',
        'smartwatches': 'others',
        'tvs': 'others',
    };

    return mapping[categorySlug.toLowerCase()] || 'others';
}

async function main() {
    console.log('Koray Description Generator\n');
    console.log('Generating Koray-compliant product descriptions...\n');

    // 1. Fetch products that need descriptions
    let query = supabase
        .from('products')
        .select(`
            id,
            name,
            slug,
            description,
            price,
            brand,
            category_id,
            specifications,
            categories!inner(name, slug)
        `)
        .eq('status', 'active')
        .order('name');

    // Apply category filter if specified
    if (CATEGORY) {
        console.log(`Filtering to category group: ${CATEGORY}\n`);
    }

    const { data: allProducts, error } = await query;

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    // Transform products
    let products: Product[] = allProducts.map((p: any) => ({
        ...p,
        category_name: p.categories?.name || 'Unknown',
        category_slug: p.categories?.slug || 'unknown',
    }));

    // Filter by category group if specified
    if (CATEGORY) {
        products = products.filter(p => getCategoryGroup(p.category_slug || '') === CATEGORY);
    }

    // Filter to products that NEED new descriptions (no H2 structure currently)
    products = products.filter(p => {
        const desc = p.description || '';
        // Products that need update: no description, thin content, or missing H2 questions
        return !desc ||
            desc.length < 500 ||
            !desc.includes('<h2>') ||
            !desc.includes('?</h2>') ||
            !desc.toLowerCase().includes('nigeria');
    });

    if (LIMIT > 0) {
        products = products.slice(0, LIMIT);
    }

    console.log(`Products to process: ${products.length}\n`);

    if (products.length === 0) {
        console.log('No products need description updates.');
        return;
    }

    // 2. Process in batches
    const results: GenerationResult[] = [];
    const batches = Math.ceil(products.length / BATCH_SIZE);

    console.log(`Processing ${batches} batches of up to ${BATCH_SIZE} products each...\n`);

    for (let i = 0; i < batches; i++) {
        const batchStart = i * BATCH_SIZE;
        const batchProducts = products.slice(batchStart, batchStart + BATCH_SIZE);

        console.log(`Batch ${i + 1}/${batches}: Processing ${batchProducts.length} products...`);

        if (VERBOSE) {
            batchProducts.forEach(p => console.log(`  - ${p.name}`));
        }

        // Generate descriptions
        const batchResults = await generateBatchDescriptions(batchProducts);
        results.push(...batchResults);

        // Update database if not dry run
        if (!DRY_RUN) {
            for (const result of batchResults) {
                if (result.success && result.description) {
                    const { error: updateError } = await supabase
                        .from('products')
                        .update({ description: result.description })
                        .eq('id', result.productId);

                    if (updateError) {
                        console.error(`  Failed to update ${result.productName}: ${updateError.message}`);
                        result.success = false;
                        result.error = updateError.message;
                    } else if (VERBOSE) {
                        console.log(`  Updated: ${result.productName}`);
                    }
                }
            }
        }

        // Progress update
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        console.log(`  Progress: ${successCount} success, ${failCount} failed\n`);

        // Rate limiting - wait between batches (Gemini: 20 req/min)
        if (i < batches - 1) {
            console.log('  Waiting 3s for rate limit...\n');
            await sleep(3000);
        }
    }

    // 3. Summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log('='.repeat(60));
    console.log('GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Category: ${CATEGORY || 'ALL'}`);
    console.log(`Total Processed: ${results.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    // 4. Save results report
    const reportFile = DRY_RUN
        ? `KORAY_GENERATION_DRY_RUN_${CATEGORY || 'ALL'}.md`
        : `KORAY_GENERATION_REPORT_${CATEGORY || 'ALL'}.md`;

    let report = `# Koray Description Generation Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Mode:** ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`;
    report += `**Category:** ${CATEGORY || 'ALL'}\n\n`;
    report += `## Summary\n\n`;
    report += `| Metric | Count |\n`;
    report += `|--------|-------|\n`;
    report += `| Total Processed | ${results.length} |\n`;
    report += `| Successful | ${successCount} |\n`;
    report += `| Failed | ${failCount} |\n\n`;

    if (failCount > 0) {
        report += `## Failed Products\n\n`;
        report += `| Product | Error |\n`;
        report += `|---------|-------|\n`;
        for (const result of results.filter(r => !r.success)) {
            report += `| ${result.productName} | ${result.error} |\n`;
        }
        report += '\n';
    }

    if (DRY_RUN && successCount > 0) {
        report += `## Sample Generated Descriptions\n\n`;
        const samples = results.filter(r => r.success).slice(0, 3);
        for (const sample of samples) {
            report += `### ${sample.productName}\n\n`;
            report += `\`\`\`html\n${sample.description}\n\`\`\`\n\n`;
        }
    }

    fs.writeFileSync(reportFile, report);
    console.log(`\nReport saved to ${reportFile}`);

    // Also save JSON for programmatic use
    const jsonFile = reportFile.replace('.md', '.json');
    fs.writeFileSync(jsonFile, JSON.stringify({
        generated: new Date().toISOString(),
        mode: DRY_RUN ? 'dry_run' : 'live',
        category: CATEGORY || 'all',
        total: results.length,
        successful: successCount,
        failed: failCount,
        results: results.map(r => ({
            id: r.productId,
            name: r.productName,
            success: r.success,
            error: r.error,
            // Only include description in dry run for review
            ...(DRY_RUN && r.success ? { description: r.description } : {}),
        })),
    }, null, 2));
    console.log(`JSON data saved to ${jsonFile}`);

    if (DRY_RUN) {
        console.log('\nRun without --dry-run to apply changes to the database');
    }
}

main().catch(console.error);
