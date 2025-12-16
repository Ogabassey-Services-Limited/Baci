
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const OUTPUT_DIR = 'samsung_mobile_images';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Official high-res fallback URLs
const IMAGES = {
    // TABS
    'tab s9 ultra': 'https://image-us.samsung.com/SamsungUS/home/mobile/tablets/galaxy-tab-s/galaxy-tab-s9-ultra/gallery/graphite/01-Galaxy-Tab-S9-Ultra-Graphite-Front-Key-Visual.jpg',
    'tab s9+': 'https://image-us.samsung.com/SamsungUS/home/mobile/tablets/galaxy-tab-s/galaxy-tab-s9-plus/gallery/graphite/01-Galaxy-Tab-S9-Plus-Graphite-Front-Key-Visual.jpg',
    'tab s9': 'https://image-us.samsung.com/SamsungUS/home/mobile/tablets/galaxy-tab-s/galaxy-tab-s9/gallery/beige/01-Galaxy-Tab-S9-Beige-Front-Key-Visual.jpg',
    'tab s9 fe': 'https://image-us.samsung.com/SamsungUS/home/mobile/tablets/galaxy-tab-s/galaxy-tab-s9-fe/gallery/gray/01-Galaxy-Tab-S9-FE-Gray-Front-Key-Visual.jpg',
    'tab a9+': 'https://image-us.samsung.com/SamsungUS/home/mobile/tablets/galaxy-tab-a/galaxy-tab-a9-plus/gallery/graphite/01-Galaxy-Tab-A9-Plus-Graphite-Front-Key-Visual.jpg',
    'tab a7 lite': 'https://image-us.samsung.com/SamsungUS/home/mobile/tablets/galaxy-tab-a/galaxy-tab-a7-lite/gallery/gray/01-Galaxy-Tab-A7-Lite-Gray-Front-Key-Visual.jpg',

    // WATCHES
    'watch6 classic': 'https://image-us.samsung.com/SamsungUS/home/mobile/wearables/smartwatches/galaxy-watch6-classic/gallery/silver/Galaxy-Watch6-Classic-Silver-1.jpg',
    'watch6': 'https://image-us.samsung.com/SamsungUS/home/mobile/wearables/smartwatches/galaxy-watch6/gallery/graphite/Galaxy-Watch6-Graphite-1.jpg',
    'watch5 pro': 'https://image-us.samsung.com/SamsungUS/home/mobile/wearables/smartwatches/galaxy-watch5-pro/gallery/black-titanium/Galaxy-Watch5-Pro-Black-Titanium-1.jpg',
    'watch5': 'https://image-us.samsung.com/SamsungUS/home/mobile/wearables/smartwatches/galaxy-watch5/gallery/graphite/Galaxy-Watch5-Graphite-1.jpg',
    'watch4 classic': 'https://image-us.samsung.com/SamsungUS/home/mobile/wearables/smartwatches/galaxy-watch4-classic/gallery/black/Galaxy-Watch4-Classic-Black-1.jpg',
    'watch4': 'https://image-us.samsung.com/SamsungUS/home/mobile/wearables/smartwatches/galaxy-watch4/gallery/black/Galaxy-Watch4-Black-1.jpg',

    // FOLDABLES (Existing ones should be fine, but fallback ref)
    'fold 5': 'https://image-us.samsung.com/SamsungUS/home/mobile/phones/galaxy-z/galaxy-z-fold5/gallery/phantom-black/Galaxy-Z-Fold5-Phantom-Black-1.jpg',
    'flip 5': 'https://image-us.samsung.com/SamsungUS/home/mobile/phones/galaxy-z/galaxy-z-flip5/gallery/graphite/Galaxy-Z-Flip5-Graphite-1.jpg'
};

async function run() {
    console.log("📱 Starting Samsung Mobile (Watch/Tab) Sourcing...");

    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug')
        .ilike('brand', 'Samsung')
        .or('name.ilike.%Watch%,name.ilike.%Tab%,name.ilike.%Fold%,name.ilike.%Flip%')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived');

    if (!products || products.length === 0) {
        console.log("No missing Mobile images found.");
        return;
    }

    console.log(`Found ${products.length} missing Mobile products.`);

    const skippedFuture = [];

    for (const p of products) {
        const nameLower = p.name.toLowerCase();

        // Check Future
        if (nameLower.includes('fold 7') || nameLower.includes('watch 8') || nameLower.includes('tab a11') || nameLower.includes('s25')) {
            skippedFuture.push(p.name);
            continue;
        }

        // Find Match
        let targetUrl = '';
        // Order matters: More specific first
        if (nameLower.includes('watch6 classic')) targetUrl = IMAGES['watch6 classic'];
        else if (nameLower.includes('watch6')) targetUrl = IMAGES['watch6'];
        else if (nameLower.includes('watch5 pro')) targetUrl = IMAGES['watch5 pro'];
        else if (nameLower.includes('watch5')) targetUrl = IMAGES['watch5'];
        else if (nameLower.includes('watch4 classic')) targetUrl = IMAGES['watch4 classic'];
        else if (nameLower.includes('watch4')) targetUrl = IMAGES['watch4'];
        else if (nameLower.includes('tab s9 ultra')) targetUrl = IMAGES['tab s9 ultra'];
        else if (nameLower.includes('tab s9+')) targetUrl = IMAGES['tab s9+'];
        else if (nameLower.includes('tab s9 fe')) targetUrl = IMAGES['tab s9 fe']; // Check before base S9
        else if (nameLower.includes('tab s9')) targetUrl = IMAGES['tab s9'];
        else if (nameLower.includes('tab a9')) targetUrl = IMAGES['tab a9+']; // Fallback
        else if (nameLower.includes('tab a7')) targetUrl = IMAGES['tab a7 lite'];
        else if (nameLower.includes('fold 5')) targetUrl = IMAGES['fold 5'];
        else if (nameLower.includes('flip 5')) targetUrl = IMAGES['flip 5'];

        if (!targetUrl) {
            console.log(`   ⚠️ No stock image mapping for: ${p.name}`);
            continue;
        }

        console.log(`[${p.name}] -> ${targetUrl}`);

        const ext = '.jpg';
        const rawFilename = `${p.slug}_raw${ext}`;
        const rawPath = path.join(OUTPUT_DIR, rawFilename);

        try {
            const res = await fetch(targetUrl, { headers: { 'User-Agent': UA } });
            if (!res.ok) {
                // Try simple fallback if Key Visual fails (remove "-Front-Key-Visual")
                const fallbackUrl = targetUrl.replace('-Front-Key-Visual', '');
                const res2 = await fetch(fallbackUrl, { headers: { 'User-Agent': UA } });
                if (!res2.ok) throw new Error(`HTTP ${res.status} & ${res2.status}`);
                const buffer = await res2.arrayBuffer();
                fs.writeFileSync(rawPath, Buffer.from(buffer));
            } else {
                const buffer = await res.arrayBuffer();
                fs.writeFileSync(rawPath, Buffer.from(buffer));
            }

            // Brand
            const brandedFilename = `${p.slug}${ext}`;
            const brandedPath = path.join(OUTPUT_DIR, brandedFilename);
            await execAsync(`npx tsx scripts/apply-red-ring.ts "${rawPath}" "${brandedPath}"`);
            console.log(`   ✅ Saved & Branded: ${brandedFilename}`);

        } catch (e) {
            console.error(`   ❌ Failed: ${e}`);
        }
    }

    if (skippedFuture.length > 0) {
        console.log(`\n🔮 Skipped ${skippedFuture.length} Future Products (No Official Images):`);
        fs.writeFileSync('missing_future_products.md', skippedFuture.map(n => `- ${n}`).join('\n'));
        console.log('   Saved list to missing_future_products.md');
    }
}

run().catch(console.error);
