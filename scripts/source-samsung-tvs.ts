
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUTPUT_DIR = 'samsung_tv_images';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url: string) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

async function searchProduct(query: string): Promise<string | null> {
    // We cannot use Google Search API directly without key.
    // We will use a heuristic: Direct image search on specific high-quality domains IF we had a browser.
    // Instead, we will try to construct a B&H URL or Samsung URL.
    return null;
}

// Hardcoded B&H / Samsung Image Base
// Samsung images often follow: https://image-us.samsung.com/SamsungUS/home/home-appliances/ranges/gas/nx58h5600ss/NX58H5600SS_01_Stainless_S.jpg
// But we need the SKU.

async function run() {
    console.log("📺 Starting Samsung TV/Audio Sourcing...");

    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug')
        .ilike('brand', 'Samsung')
        .or('name.ilike.%TV%,name.ilike.%Sound Bar%,name.ilike.%Monitor%')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived');

    if (!products || products.length === 0) {
        console.log("No missing TV/Audio images found.");
        return;
    }

    console.log(`Found ${products.length} missing TV/Audio products.`);

    // For TVs, we will use a "Best Match" from a predefined list of high-quality stock images
    // because specific model matching for "55 inch UHD" (generic name) is error prone.
    // We will download a set of 'Generic Samsung TV' images (QLED, Crystal UHD, Frame) 
    // and map them based on keywords.

    // Mapping Logic:
    // QLED -> qled_generic.jpg
    // Crystal UHD -> crystal_uhd_generic.jpg
    // Soundbar -> soundbar_generic.jpg

    // For specific high-end models (Neo QLED), we try to be specific.

    const stockImages = {
        'qled': 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/tvs/qled-tvs/q80a/gallery/Q80A_001_Front_Titan_Black.jpg', // Generic QLED
        'neo qled': 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/tvs/neo-qled-4k/qn85b/gallery/QN85B_001_Front_Titan_Black.jpg',
        'crystal': 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/tvs/crystal-uhd/au8000/gallery/AU8000_001_Front_Black.jpg',
        'oled': 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/tvs/oled-tvs/s95b/gallery/S95B_001_Front_Black.jpg',
        'uhd': 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/tvs/crystal-uhd/au8000/gallery/AU8000_001_Front_Black.jpg', // Fallback to Crystal
        'curved': 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/tvs/curved-tvs/tu8300/gallery/TU8300_001_Front_Black.jpg',
        'sound bar': 'https://image-us.samsung.com/SamsungUS/home/television-home-theater/home-theater/sound-bars/q-series/hw-q990b/HW-Q990B_001_Front_Black.jpg', // Premium Soundbar generic
        'monitor': 'https://image-us.samsung.com/SamsungUS/home/computing/monitors/gaming/odyssey-g7/Odyssey_G7_001_Front_Black.jpg'
    };

    for (const p of products) {
        const nameLower = p.name.toLowerCase();
        let targetUrl = '';

        if (nameLower.includes('sound bar')) targetUrl = stockImages['sound bar'];
        else if (nameLower.includes('neo qled')) targetUrl = stockImages['neo qled'];
        else if (nameLower.includes('qled')) targetUrl = stockImages['qled'];
        else if (nameLower.includes('oled')) targetUrl = stockImages['oled'];
        else if (nameLower.includes('curved')) targetUrl = stockImages['curved'];
        else if (nameLower.includes('monitor')) targetUrl = stockImages['monitor'];
        else targetUrl = stockImages['crystal']; // Default TV

        console.log(`[${p.name}] -> ${targetUrl}`);

        const ext = '.jpg';
        const rawFilename = `${p.slug}_raw${ext}`;
        const rawPath = path.join(OUTPUT_DIR, rawFilename);

        try {
            const res = await fetch(targetUrl, { headers: { 'User-Agent': UA } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = await res.arrayBuffer();
            fs.writeFileSync(rawPath, Buffer.from(buffer));

            // Brand
            const brandedFilename = `${p.slug}${ext}`;
            const brandedPath = path.join(OUTPUT_DIR, brandedFilename);
            await execAsync(`npx tsx scripts/apply-red-ring.ts "${rawPath}" "${brandedPath}"`);
            console.log(`   ✅ Saved & Branded: ${brandedFilename}`);

            // Update DB? User handles upload in separate step usually.
        } catch (e) {
            console.error(`   ❌ Failed: ${e}`);
        }
    }
}

run().catch(console.error);
