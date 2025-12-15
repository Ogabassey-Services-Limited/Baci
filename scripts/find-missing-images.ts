
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('🔍 Auditing products for missing images...');

    // specific filter: images is null or empty array
    // We want to group by Brand or Category
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, brand, category, is_parent, status')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived') // Ignore archived
        .order('brand', { ascending: true });

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    if (!products || products.length === 0) {
        console.log('✅ Great! No active products found with missing images.');
        return;
    }

    console.log(`⚠️ Found ${products.length} active products without images.`);

    // Group by Brand
    const byBrand: Record<string, typeof products> = {};
    products.forEach(p => {
        const brand = p.brand || 'Unbranded';
        if (!byBrand[brand]) byBrand[brand] = [];
        byBrand[brand].push(p);
    });

    // Generate Report
    let report = `# Missing Images Report\nGenerated: ${new Date().toISOString()}\n\n`;
    report += `**Total Missing:** ${products.length}\n\n`;

    for (const [brand, items] of Object.entries(byBrand)) {
        report += `## ${brand} (${items.length})\n`;
        items.forEach(p => {
            report += `- [${p.is_parent ? 'PARENT' : 'VARIANT'}] ${p.name} (Category: ${p.category})\n`;
        });
        report += `\n`;
    }

    fs.writeFileSync('MISSING_IMAGES_REPORT.md', report);
    console.log('📝 Report saved to MISSING_IMAGES_REPORT.md');
}

main().catch(console.error);
