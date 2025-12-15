import fs from 'fs';
import { execSafe } from './lib/exec-safe';
import path from 'path';

// Apple CDN URL Pattern
const CDN_BASE = 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is';

// iPhone 17 Pro variants discovered from apple.com
const IPHONE_17_PRO_VARIANTS = [
    // 6.3" iPhone 17 Pro
    { slug: 'iphone-17-pro-finish-select-202509-6-3inch-silver', name: 'iPhone 17 Pro (Silver)' },
    { slug: 'iphone-17-pro-finish-select-202509-6-3inch-cosmicorange', name: 'iPhone 17 Pro (Cosmic Orange)' },
    { slug: 'iphone-17-pro-finish-select-202509-6-3inch-deepblue', name: 'iPhone 17 Pro (Deep Blue)' },
    // 6.9" iPhone 17 Pro Max
    { slug: 'iphone-17-pro-finish-select-202509-6-9inch-silver', name: 'iPhone 17 Pro Max (Silver)' },
    { slug: 'iphone-17-pro-finish-select-202509-6-9inch-cosmicorange', name: 'iPhone 17 Pro Max (Cosmic Orange)' },
    { slug: 'iphone-17-pro-finish-select-202509-6-9inch-deepblue', name: 'iPhone 17 Pro Max (Deep Blue)' },
];

// MacBook Air variants (pattern based on research)
const MACBOOK_AIR_VARIANTS = [
    { slug: 'macbook-air-m4-midnight-select-202503', name: 'MacBook Air M4 (Midnight)' },
    { slug: 'macbook-air-m4-starlight-select-202503', name: 'MacBook Air M4 (Starlight)' },
    { slug: 'macbook-air-m4-spacegray-select-202503', name: 'MacBook Air M4 (Space Gray)' },
    { slug: 'macbook-air-m4-silver-select-202503', name: 'MacBook Air M4 (Silver)' },
    { slug: 'macbook-air-m3-midnight-select-202402', name: 'MacBook Air M3 (Midnight)' },
    { slug: 'macbook-air-m3-starlight-select-202402', name: 'MacBook Air M3 (Starlight)' },
];

const ALL_VARIANTS = [...IPHONE_17_PRO_VARIANTS, ...MACBOOK_AIR_VARIANTS];
const OUTPUT_DIR = 'apple_downloaded_images';

async function downloadAppleImages() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log(`🍎 Downloading ${ALL_VARIANTS.length} Apple product images...\n`);

    interface DownloadResult {
        name: string;
        slug: string;
        localPath?: string;
        success: boolean;
    }

    const results: DownloadResult[] = [];

    for (const variant of ALL_VARIANTS) {
        const url = `${CDN_BASE}/${variant.slug}?wid=1200&hei=900&fmt=png&qlt=95`;
        const filename = `${variant.slug}.png`;
        const outputPath = path.join(OUTPUT_DIR, filename);

        console.log(`⬇️ ${variant.name}`);
        console.log(`   URL: ${url}`);

        try {
            await execSafe('curl', ['-s', url, '-o', outputPath]);

            // Check if file was actually downloaded (not an error page)
            const stats = fs.statSync(outputPath);
            if (stats.size > 5000) { // Real images are > 5KB
                console.log(`   ✅ Downloaded (${(stats.size / 1024).toFixed(0)}KB)`);

                // Apply branding
                const brandedPath = path.join(OUTPUT_DIR, `branded_${filename}`);
                await execSafe('npx', ['tsx', 'scripts/apply-red-ring.ts', outputPath, brandedPath]);
                console.log(`   ✅ Branded`);

                results.push({
                    name: variant.name,
                    slug: variant.slug,
                    localPath: brandedPath,
                    success: true
                });
            } else {
                console.log(`   ⚠️ Invalid response (${stats.size} bytes) - slug may be incorrect`);
                fs.unlinkSync(outputPath);
                results.push({ name: variant.name, slug: variant.slug, success: false });
            }
        } catch (err) {
            console.log(`   ❌ Failed: ${err}`);
            results.push({ name: variant.name, slug: variant.slug, success: false });
        }
        console.log('');
    }

    const successful = results.filter(r => r.success);
    console.log(`\n📊 Summary: ${successful.length}/${ALL_VARIANTS.length} downloaded & branded`);
    fs.writeFileSync('apple_images_results.json', JSON.stringify(results, null, 2));
}

downloadAppleImages();
