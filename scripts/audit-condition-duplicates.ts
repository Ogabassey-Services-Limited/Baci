
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Product {
    id: string;
    name: string;
    condition: string | null;
    brand: string | null;
    price: number;
    status: string;
}

async function main() {
    console.log('🔍 Auditing condition-based duplicates...\n');

    // Fetch all active products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, condition, brand, price, status')
        .neq('status', 'archived')
        .order('name');

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`📊 Total active products: ${products.length}\n`);

    // Normalize product names to find duplicates
    const normalizeProductName = (name: string): string => {
        return name
            .replace(/\s*(New|Used|Open Box|Refurbished|Brand New|UK Used|US Used|Fairly Used)\s*/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    };

    // Group by normalized name
    const groups: Record<string, Product[]> = {};

    products.forEach((p: Product) => {
        const baseName = normalizeProductName(p.name);
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(p);
    });

    // Find duplicates (groups with > 1 product)
    const duplicates = Object.entries(groups)
        .filter(([_, items]) => items.length > 1)
        .sort((a, b) => b[1].length - a[1].length);

    console.log(`⚠️ Found ${duplicates.length} product families with condition duplicates.\n`);

    // Generate report
    let report = `# Condition Duplication Audit Report\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    report += `## Summary\n`;
    report += `- **Total Active Products:** ${products.length}\n`;
    report += `- **Product Families with Duplicates:** ${duplicates.length}\n`;
    report += `- **Total Duplicate Rows:** ${duplicates.reduce((sum, [_, items]) => sum + items.length, 0)}\n`;
    report += `- **Potential Reduction:** ${duplicates.reduce((sum, [_, items]) => sum + items.length - 1, 0)} rows\n\n`;

    report += `## Top Duplicated Product Families\n\n`;

    // Show top 30 duplicates
    duplicates.slice(0, 30).forEach(([baseName, items]) => {
        report += `### ${baseName} (${items.length} variants)\n`;
        items.forEach(p => {
            const conditionLabel = p.condition || 'Unknown';
            report += `- [${conditionLabel}] ${p.name} - ₦${p.price?.toLocaleString() || 'N/A'}\n`;
        });
        report += `\n`;
    });

    // By Brand analysis
    const byBrand: Record<string, number> = {};
    duplicates.forEach(([_, items]) => {
        const brand = items[0].brand || 'Unknown';
        byBrand[brand] = (byBrand[brand] || 0) + items.length;
    });

    report += `## Duplicates by Brand\n\n`;
    report += `| Brand | Duplicate Rows |\n|-------|---------------|\n`;
    Object.entries(byBrand)
        .sort((a, b) => b[1] - a[1])
        .forEach(([brand, count]) => {
            report += `| ${brand} | ${count} |\n`;
        });

    fs.writeFileSync('CONDITION_DUPLICATION_AUDIT.md', report);
    console.log('📝 Report saved to CONDITION_DUPLICATION_AUDIT.md');

    // Quick summary to console
    console.log('\n--- Quick Summary ---');
    console.log(`Duplicate families: ${duplicates.length}`);
    console.log(`Total rows to deduplicate: ${duplicates.reduce((sum, [_, items]) => sum + items.length, 0)}`);
    console.log(`Rows that can be removed: ${duplicates.reduce((sum, [_, items]) => sum + items.length - 1, 0)}`);
}

main().catch(console.error);
