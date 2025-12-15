import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateReport() {
    console.log('Generating Audit Report...');

    // Fetch all active products once and perform audit checks locally
    // This is more efficient than multiple DB queries with unsupported filters
    const { data: allProducts, error } = await supabase
        .from('products')
        .select('id, name, brand, category, description, images')
        .eq('status', 'active');

    if (error) {
        console.error('❌ Failed to fetch products for audit:', error.message);
        process.exit(1);
    }

    if (!allProducts || allProducts.length === 0) {
        console.warn('⚠️ No active products found; skipping audit report generation.');
        return;
    }

    // Filter locally for missing images and thin descriptions
    const missingImages = allProducts.filter(p => !p.images || !Array.isArray(p.images) || p.images.length === 0);
    const thinDescriptions = allProducts.filter(p => !p.description || p.description.length < 50);

    let md = `# 🚨 Critical Data Quality Audit Report (2025 SEO Standards)

**Generated:** ${new Date().toLocaleString()}

## 1. Missing Images (Low Quality Nodes)
**Count:** ${missingImages.length}
**Impact:** These products will NOT be indexed by Google Images and will have high bounce rates. They are currently "Zombie Pages".

### Action Required
Update your seed scripts with image URLs or manually upload images via the dashboard.

| Brand | Product Name | Category |
|-------|--------------|----------|
`;

    // Group by Brand for easier fixing
    missingImages.sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));

    missingImages.forEach(p => {
        md += `| ${p.brand || 'Unknown'} | ${p.name} | ${p.category || 'N/A'} |\n`;
    });

    md += `\n\n## 2. Thin Content (Low E-E-A-T)
**Count:** ${thinDescriptions.length}
**Impact:** Google views these as "Thin Content" and may penalize the site.

| Brand | Product Name | Issue |
|-------|--------------|-------|
`;

    thinDescriptions.forEach(p => {
        md += `| ${p.brand || 'Unknown'} | ${p.name} | Description too short (${p.description?.length || 0} chars) |\n`;
    });

    fs.writeFileSync('IMMEDIATE_ACTION_REQUIRED.md', md);
    console.log('✅ Report generated: IMMEDIATE_ACTION_REQUIRED.md');
}

generateReport().catch((error) => {
    console.error('❌ Audit report generation failed:', error);
    process.exit(1);
});
