
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUTPUT_DIR = 'samsung_jumia_images';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

async function searchJumia(query: string): Promise<string | null> {
    const searchUrl = `https://www.jumia.com.ng/catalog/?q=${encodeURIComponent(query)}`;
    try {
        const html = await fetchHtml(searchUrl);

        // Find first product card: <article class="prd ...">
        // It's safer to use a simpler finding logic:
        // Look for the *first* image that contains "https://ng.jumia.is/unsafe/fit-in/" AND is inside the main catalog area.
        // But scraping raw HTML with regex is brittle.
        // Let's look for the specific class used for product images usually: class="img" 
        // AND ensure the URL contains "fit-in".

        const productMatches = html.matchAll(/<img[^>]+class="img"[^>]+data-src="([^"]+)"[^>]+alt="([^"]+)"/g);

        for (const m of productMatches) {
            const url = m[1];
            const alt = m[2];

            // Filter out banners (usually don't have "Samsung" in alt if listing is generic, OR url is different)
            // Jumia product images usually start with: https://ng.jumia.is/unsafe/fit-in/
            if (url.includes('ng.jumia.is/unsafe/fit-in/') && alt.toLowerCase().includes(query.toLowerCase().split(' ')[0])) {
                // Check if it matches at least the first word of query (e.g. "Samsung")
                return url;
            }
        }
    } catch (e) {
        console.error(`   ❌ Search Error for ${query}:`, e);
    }
    return null;
}

async function run() {
    console.log("🛒 Starting Samsung Jumia Sourcing...");

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

    console.log(`Found ${products.length} missing products.`);

    for (const p of products) {
        // Skip Future Products
        const lower = p.name.toLowerCase();
        if (lower.includes('fold 7') || lower.includes('watch 8') || lower.includes('s25') || lower.includes('tab s10')) {
            console.log(`⏩ Skipping Future Product: ${p.name}`);
            continue;
        }

        console.log(`🔎 Searching Jumia for: ${p.name}`);
        const imgUrl = await searchJumia(p.name);

        if (imgUrl) {
            // Upgrade Resolution: 300x300 -> 800x800
            const highResUrl = imgUrl.replace('300x300', '800x800').replace('fit-in/300x300', 'fit-in/800x800');
            console.log(`   found: ${highResUrl}`);

            const ext = '.jpg';
            const rawFilename = `${p.slug}_raw${ext}`;
            const rawPath = path.join(OUTPUT_DIR, rawFilename);

            try {
                const res = await fetch(highResUrl, { headers: { 'User-Agent': UA } });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const buffer = await res.arrayBuffer();
                fs.writeFileSync(rawPath, Buffer.from(buffer));

                // Brand
                const brandedFilename = `${p.slug}${ext}`;
                const brandedPath = path.join(OUTPUT_DIR, brandedFilename);
                await execAsync(`npx tsx scripts/apply-red-ring.ts "${rawPath}" "${brandedPath}"`);
                console.log(`   ✅ Saved & Branded: ${brandedFilename}`);

            } catch (e) {
                console.error(`   ❌ Download/Brand Failed: ${e}`);
            }
        } else {
            console.warn(`   ⚠️ No image found on Jumia for: ${p.name}`);
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 1000));
    }
}

run().catch(console.error);
