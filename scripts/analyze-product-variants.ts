import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Product {
    id: string;
    name: string;
    slug: string;
    merchant_id: string;
    condition: string | null;
    condition_detail: string | null;
    price: number;
    description: string | null;
    specs?: any; // If available or strictly from description
}

async function analyzeVariants() {
    console.log('🔍 Fetching all products to look for name-duplicates...');

    // 1. Fetch all products (getting minimal fields first to group in memory, or use SQL if possible. 
    // Since we saw SQL worked well, let's use that to get the names first, then fetch details)

    // Using in-memory approach for flexibility in analysis since dataset seems manageable (<10k)
    let allProducts: Product[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('id, name, slug, merchant_id, condition, condition_detail, price, description') // 'condition' might be in metadata or column? Based on previous SQL it's a column
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching:', error);
            process.exit(1);
        }
        if (!data || data.length === 0) break;
        allProducts.push(...data as any[]);
        console.log(`Fetched ${allProducts.length} products...`);
        page++;
    }

    // 2. Group by Name + Merchant
    const groups = new Map<string, Product[]>();
    for (const p of allProducts) {
        if (!p.name) continue;
        const key = `${p.merchant_id}||${p.name.trim()}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(p);
    }

    // 3. Filter for groups with > 1 item
    const duplicates = Array.from(groups.entries()).filter(([_, items]) => items.length > 1);

    console.log(`Found ${duplicates.length} sets of potential duplicates.`);

    let md = '# Product Consolidated Variants Report\n\n';
    md += `Generated: ${new Date().toLocaleString()}\n`;
    md += `Total Sets of Duplicates: ${duplicates.length}\n\n`;

    // Categories
    const conditionVariants: any[] = [];
    const platformVariants: any[] = [];
    const exactDuplicates: any[] = [];
    const other: any[] = [];

    for (const [key, items] of duplicates) {
        const [merchantId, name] = key.split('||');

        // Analyze the set
        const conditions = new Set(items.map(i => (i.condition || 'new').toLowerCase()));
        const platforms = new Set();

        // Naive platform check from description or name
        const platformKeywords = ['ps4', 'ps5', 'xbox', 'nintendo', 'switch', 'pc'];
        const itemPlatforms = items.map(i => {
            const text = ((i.description || '') + ' ' + (i.name || '')).toLowerCase();
            return platformKeywords.find(k => text.includes(k));
        });

        const uniquePlatforms = new Set(itemPlatforms.filter(p => p));

        // Logic to categorize
        const isConditionVariant = conditions.size > 1; // e.g. New vs Used
        const isPlatformVariant = uniquePlatforms.size > 1; // e.g. PS4 vs PS5

        const summary = {
            name,
            merchantId,
            items: items.map(i => ({
                id: i.id,
                slug: i.slug,
                price: i.price,
                condition: i.condition,
                conditionDetail: i.condition_detail,
                platform: itemPlatforms.find((_, idx) => items[idx].id === i.id) || 'unknown'
            }))
        };

        if (isConditionVariant) {
            conditionVariants.push(summary);
        } else if (isPlatformVariant) {
            platformVariants.push(summary);
        } else {
            // Check for exact price match?
            const prices = new Set(items.map(i => i.price));
            if (prices.size === 1 && items.length > 1) {
                exactDuplicates.push(summary);
            } else {
                other.push(summary);
            }
        }
    }

    // 4. Output Markdown

    // --- SECTION 1: CONDITION VARIANTS ---
    md += `## 🟢 Condition Consolidation Candidates (${conditionVariants.length})\n`;
    md += `These products share the same name but have different conditions (e.g., New vs Used). **Recommendation: Merge into one product with variants.**\n\n`;

    conditionVariants.forEach(group => {
        md += `### ${group.name}\n`;
        md += `| Condition | Price | ID | Details |\n`;
        md += `|---|---|---|---|\n`;
        group.items.forEach((item: any) => {
            md += `| ${item.condition} (${item.conditionDetail || '-'}) | ₦${item.price.toLocaleString()} | \`${item.id}\` | [Link](/prod/${item.slug}) |\n`;
        });
        md += `\n`;
    });

    // --- SECTION 2: PLATFORM VARIANTS ---
    // User requested to remove this section
    /*
    md += `## 🎮 Platform Variants (${platformVariants.length})\n`;
    md += `These products share the same name but appear to be for different platforms. **Recommendation: Keep separate OR add Platform variant option.**\n\n`;
    
    platformVariants.forEach(group => {
        md += `### ${group.name}\n`;
        md += `| Platform | Price | ID | Details |\n`;
        md += `|---|---|---|---|\n`;
        group.items.forEach((item: any) => {
            md += `| ${item.platform?.toUpperCase() || 'Unknown'} | ₦${item.price.toLocaleString()} | \`${item.id}\` | [Link](/prod/${item.slug}) |\n`;
        });
        md += `\n`;
    });
    */

    // --- SECTION 3: OTHER / POTENTIAL DUPLICATES ---
    md += `## ⚠️ Potential Exact Duplicates / Unclear (${exactDuplicates.length + other.length})\n`;
    md += `These have the same name and no obvious condition/platform difference detected by this script.\n\n`;

    [...exactDuplicates, ...other].forEach(group => {
        md += `### ${group.name}\n`;
        md += `| Price | Condition | ID | Platform Hint |\n`;
        md += `|---|---|---|---|\n`;
        group.items.forEach((item: any) => {
            md += `| ₦${item.price.toLocaleString()} | ${item.condition} | \`${item.id}\` | ${item.platform || '-'} |\n`;
        });
        md += `\n`;
    });

    fs.writeFileSync('product_variants_report.md', md);
    console.log('✅ Generated product_variants_report.md');
}

analyzeVariants().catch(e => console.error(e));
