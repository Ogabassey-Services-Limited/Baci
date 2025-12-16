
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUTPUT_FILE = '/Users/mac/.gemini/antigravity/brain/4aeec873-36ce-47f3-ada5-5a997bf72b09/samsung_sourcing_checklist.md';

async function run() {
    console.log("📝 Generating Manual Sourcing Checklist...");

    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug')
        .ilike('brand', 'Samsung')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived')
        .order('name');

    if (!products || products.length === 0) {
        console.log("No missing images found.");
        return;
    }

    let md = `# 📸 Samsung Image Sourcing Checklist\n\n`;
    md += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
    md += `**Missing Count:** ${products.length}\n\n`;

    md += `> **Instruction:**\n`;
    md += `> 1. Click the **Google Search** link for each product.\n`;
    md += `> 2. Find a **High Resolution (Large)** image with a **White Background** (Official Render).\n`;
    md += `> 3. Save the image to \`/Users/mac/Baci-app/Baci/public/website designs/SAMSUNG/\` using the **Slug** filename (e.g., \`samsung-galaxy-tab-s9.jpg\`).\n`;
    md += `> 4. Once finished, notify the AI to run branding and deployment.\n\n`;

    md += `| Product Name | Slug (Filename) | Search Link | Status |\n`;
    md += `|---|---|---|---|\n`;

    for (const p of products) {
        // Clean name for search
        const query = `${p.name} official render white background`;
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&tbs=isz:l`;

        md += `| **${p.name}** | \`${p.slug}\` | [🔍 Find Image](${googleUrl}) | [ ] |\n`;
    }

    fs.writeFileSync(OUTPUT_FILE, md);
    console.log(`✅ Checklist generated at: ${OUTPUT_FILE}`);
}

run().catch(console.error);
