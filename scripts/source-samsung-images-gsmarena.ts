
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const OUTPUT_DIR = 'samsung_downloaded_images';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

async function searchGsmArena(query: string): Promise<string | null> {
    const searchUrl = `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query)}`;
    try {
        const html = await fetchHtml(searchUrl);
        // Find first product link: <div class="makers"><ul><li><a href="samsung_galaxy_s24_ultra-12771.php">
        const match = html.match(/<div class="makers">.*?<a href="(.*?)">/s);
        if (match && match[1]) {
            return `https://www.gsmarena.com/${match[1]}`;
        }
    } catch (e) {
        console.error(`Error searching for ${query}:`, e);
    }
    return null;
}

async function getProductImage(url: string): Promise<string | null> {
    try {
        const html = await fetchHtml(url);
        // Find main image: <div class="specs-photo-main"><a href=...><img src=...>
        const match = html.match(/<div class="specs-photo-main">.*?<img src="(.*?)"/s);
        if (match && match[1]) {
            return match[1];
        }
    } catch (e) {
        console.error(`Error getting image from ${url}:`, e);
    }
    return null;
}

async function downloadFile(url: string, dest: string) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
}

async function run() {
    console.log('🚀 Starting Samsung Image Sourcing (GSMArena)...');

    // 1. Get Missing Products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, slug')
        .ilike('brand', 'Samsung')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived');

    if (error) throw error;
    console.log(`Found ${products.length} missing products.`);

    for (const p of products) {
        // clean name
        const cleanName = p.name
            .replace(/\(.*\)/g, '')
            .replace(/(Brand )?(New|Used|Open Box|Refurbished|Grade [A-C])/gi, '')
            .replace(/\d+GB|\d+TB/gi, '')
            .replace(/\d+mm/gi, '') // Watch sizes often confuse search if exact match fails
            .replace(/Samsung/gi, '')
            .replace(/Galaxy/gi, '')
            .trim();

        const searchQuery = `Samsung Galaxy ${cleanName}`; // Re-add brand for search context
        console.log(`\n🔍 Searching: ${searchQuery} (${p.name})`);

        const productUrl = await searchGsmArena(searchQuery);
        if (!productUrl) {
            console.log('   ❌ No results found.');
            continue;
        }

        console.log(`   🔗 Found Page: ${productUrl}`);
        const imgUrl = await getProductImage(productUrl);

        if (!imgUrl) {
            console.log('   ❌ No image found on page.');
            continue;
        }

        console.log(`   📸 Image URL: ${imgUrl}`);
        const ext = path.extname(imgUrl) || '.jpg';
        const rawFilename = `${p.slug}_raw${ext}`;
        const rawPath = path.join(OUTPUT_DIR, rawFilename);

        await downloadFile(imgUrl, rawPath);
        console.log(`   ⬇️ Downloaded raw.`);

        // Apply Red Ring
        const brandedFilename = `${p.slug}${ext}`; // Final name
        const brandedPath = path.join(OUTPUT_DIR, brandedFilename);

        try {
            // Using exec to call tsx scripts/apply-red-ring.ts
            await execAsync(`npx tsx scripts/apply-red-ring.ts "${rawPath}" "${brandedPath}"`);
            console.log(`   ✅ Branded: ${brandedFilename}`);
        } catch (e) {
            console.error(`   ❌ Branding failed:`, e);
        }
    }
}

run().catch(console.error);
