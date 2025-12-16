
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUTPUT_DIR = 'samsung_jumia_v2';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

// Jumia-specific: Extract first PRODUCT image from search results
// Look for: <img class="core" data-src="https://ng.jumia.is/unsafe/fit-in/300x300/..." />
// OR: <img data-src="https://ng.jumia.is/unsafe/fit-in/300x300/..." src="..." alt="..." class="..." />
function extractJumiaProductImage(html: string): string | null {
    // Pattern 1: Core image class (usually the actual product image)
    // Pattern 2: Image inside article.prd with data-src
    // Jumia uses lazy loading, so we look for data-src attributes

    // Find all data-src URLs that point to Jumia's image CDN
    const matches = html.matchAll(/data-src="(https:\/\/ng\.jumia\.is\/unsafe\/fit-in\/\d+x\d+\/[^"]+)"/g);

    for (const m of matches) {
        const url = m[1];
        // Filter out banners/ads (they usually don't have 'product' in path or are GIFs)
        if (url.includes('.gif') || url.includes('cms/')) continue;
        // Upgrade resolution if possible (300x300 -> 680x680 is Jumia's max for search)
        return url.replace(/fit-in\/\d+x\d+/, 'fit-in/680x680');
    }
    return null;
}

// Build Jumia search query from product name
function buildJumiaQuery(name: string): string {
    // Clean up product name for Jumia search
    // Remove special chars, simplify
    return name
        .replace(/\([^)]*\)/g, '') // Remove parenthetical notes
        .replace(/[""]/g, '"')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function run() {
    console.log("🛒 Starting Samsung Jumia V2 Sourcing...");

    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug')
        .ilike('brand', 'Samsung')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived')
        .order('name');

    if (!products || products.length === 0) {
        console.log("No missing Samsung images found.");
        return;
    }

    console.log(`Found ${products.length} missing products.\n`);

    // Skip known future products
    const futureKeywords = ['fold 7', 'watch 8', 'flip 7', 'tab s10', 'tab a11', 's25'];
    let successCount = 0;

    for (const p of products) {
        const lower = p.name.toLowerCase();
        if (futureKeywords.some(k => lower.includes(k))) {
            console.log(`⏩ Skip Future: ${p.name}`);
            continue;
        }

        const query = buildJumiaQuery(p.name);
        const searchUrl = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(query)}`;
        console.log(`🔎 Searching: ${p.name.substring(0, 50)}...`);

        try {
            const html = await fetchHtml(searchUrl);
            const imgUrl = extractJumiaProductImage(html);

            if (!imgUrl) {
                console.log(`   ⚠️ No image found`);
                continue;
            }

            console.log(`   📦 Found: ${imgUrl.substring(0, 80)}...`);

            // Download
            const ext = '.jpg';
            const rawFilename = `${p.slug}_raw${ext}`;
            const rawPath = path.join(OUTPUT_DIR, rawFilename);

            const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA } });
            if (!imgRes.ok) throw new Error(`Image HTTP ${imgRes.status}`);

            const buffer = await imgRes.arrayBuffer();
            fs.writeFileSync(rawPath, Buffer.from(buffer));

            // Brand
            const brandedFilename = `${p.slug}${ext}`;
            const brandedPath = path.join(OUTPUT_DIR, brandedFilename);
            await execAsync(`npx tsx scripts/apply-red-ring.ts "${rawPath}" "${brandedPath}"`);

            console.log(`   ✅ Saved: ${brandedFilename}`);
            successCount++;

        } catch (e) {
            console.error(`   ❌ Error:`, e instanceof Error ? e.message : e);
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 800));
    }

    console.log(`\n📊 Summary: ${successCount} images sourced successfully.`);
}

run().catch(console.error);
