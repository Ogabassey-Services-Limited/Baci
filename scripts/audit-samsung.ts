import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSamsungProducts() {
    console.log('🔍 Starting Samsung Product Audit...');

    // 1. Fetch all 'Samsung' brand products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug, condition, images, specifications, metadata, status, category')
        .ilike('brand', 'Samsung')
        .neq('status', 'archived');

    if (error) throw error;
    if (!products || products.length === 0) {
        console.log('No Samsung products found.');
        return;
    }

    console.log(`\n📦 Found ${products.length} active Samsung products.`);

    // 2. Identify Duplicates (Condition-based)
    // Group by "Base Name" (removing condition suffix)
    const productGroups: Record<string, typeof products> = {};

    products.forEach(p => {
        // Basic normalization: remove trailing condition keywords relative to our known conditions
        const baseName = p.name
            .replace(/\s(New|Used|Open Box|Refurbished|Grade [A-C])$/i, '')
            .trim();

        if (!productGroups[baseName]) {
            productGroups[baseName] = [];
        }
        productGroups[baseName].push(p);
    });

    const exactDuplicates: any[] = [];
    const conditionVariants: any[] = [];
    const s24Series: any[] = [];

    Object.entries(productGroups).forEach(([baseName, group]) => {
        if (baseName.includes('S24') || baseName.includes('s24')) {
            s24Series.push(...group);
        }

        if (group.length > 1) {
            conditionVariants.push({
                baseName,
                count: group.length,
                conditions: group.map(p => p.condition || 'null'),
                ids: group.map(p => p.id)
            });
        }
    });

    // 3. Check for Missing Images
    const missingImages = products.filter(p =>
        !p.images ||
        p.images.length === 0 ||
        (Array.isArray(p.images) && p.images.length === 0) ||
        p.images === 'null'
    );

    // 4. Check for Missing Specs
    const missingSpecs = products.filter(p =>
        !p.specifications ||
        Object.keys(p.specifications).length === 0 ||
        // If it's just an empty object or null
        JSON.stringify(p.specifications) === '{}'
    );


    // 5. Generate Report
    let report = `# Samsung Product Audit Report (${new Date().toISOString().split('T')[0]})\n\n`;

    report += `## Summary\n`;
    report += `- **Total Active Products**: ${products.length}\n`;
    report += `- **Condition-Based Duplicate Groups**: ${conditionVariants.length}\n`;
    report += `- **Missing Images**: ${missingImages.length}\n`;
    report += `- **Missing Specs**: ${missingSpecs.length}\n`;
    report += `- **S24 Series Products**: ${s24Series.length}\n\n`;

    report += `## 1. S24 Series (Priority)\n`;
    const s24Groups: Record<string, any[]> = {};
    s24Series.forEach(p => {
        const name = p.name;
        if (!s24Groups[name]) s24Groups[name] = [];
        s24Groups[name].push(p);
    });

    Object.entries(s24Groups).forEach(([name, group]) => {
        report += `- **${name}**: ${group.length} rows (Conditions: ${group.map((g: any) => g.condition).join(', ')})\n`;
    });
    report += `\n`;

    report += `## 2. Condition Duplicates (To Consolidate)\n`;
    conditionVariants.sort((a, b) => b.count - a.count).forEach(group => {
        report += `- **${group.baseName}**: ${group.count} variants (${group.conditions.join(', ')})\n`;
    });
    report += `\n`;

    report += `## 3. Missing Images (${missingImages.length})\n`;
    missingImages.forEach(p => {
        report += `- [ ] ${p.name} (ID: ${p.id})\n`;
    });
    report += `\n`;

    report += `## 4. Missing Specs (${missingSpecs.length})\n`;
    // Limit to top 20 for brevity in report if huge
    missingSpecs.slice(0, 50).forEach(p => {
        report += `- [ ] ${p.name}\n`;
    });
    if (missingSpecs.length > 50) report += `... and ${missingSpecs.length - 50} more.\n`;


    fs.writeFileSync('samsung_audit_report.md', report);
    console.log('✅ Audit Complete. Report saved to samsung_audit_report.md');
}

checkSamsungProducts().catch(console.error);
