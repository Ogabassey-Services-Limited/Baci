import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VPS_USER = 'bassey';
const VPS_IP = '82.29.190.219';
const VPS_PATH = '/var/www/cdn/products';
const CDN_BASE = 'https://cdn.ogabassey.com/products/';
const STAGE_DIR = 'scripts/staging_gallery';

interface GalleryMatch {
    productId: string;
    productName: string;
    slug: string;
    images: string[];
}

function slugifyFilename(productSlug: string, imagePath: string, index: number): string {
    const ext = path.extname(imagePath);
    // Extract color from filename if possible
    const filename = path.basename(imagePath, ext).toLowerCase();
    const colors = ['midnight', 'starlight', 'red', 'silver', 'gold', 'blue', 'green', 'graphite',
        'black', 'white', 'pink', 'purple', 'cream', 'navy', 'olive', 'lavender', 'yellow', 'orange'];
    const color = colors.find(c => filename.includes(c)) || `variant-${index + 1}`;

    return `${productSlug}-${color}${ext}`.toLowerCase();
}

async function deploy() {
    console.log('🚀 Starting Gallery Deployment...');

    // 1. Load Gallery Matches
    const data: GalleryMatch[] = JSON.parse(fs.readFileSync('scripts/gallery_matches.json', 'utf-8'));
    console.log(`📦 Products to update: ${data.length}`);

    // 2. Prepare Staging
    if (fs.existsSync(STAGE_DIR)) fs.rmSync(STAGE_DIR, { recursive: true, force: true });
    fs.mkdirSync(STAGE_DIR);

    // 3. Process Each Product
    const dbUpdates: { id: string; urls: string[] }[] = [];
    let totalImages = 0;

    for (const product of data) {
        const urls: string[] = [];

        for (let i = 0; i < product.images.length; i++) {
            const srcPath = product.images[i];

            if (!fs.existsSync(srcPath)) {
                console.warn(`   ⚠️ Missing: ${srcPath}`);
                continue;
            }

            const destFilename = slugifyFilename(product.slug, srcPath, i);
            const destPath = path.join(STAGE_DIR, destFilename);

            // Avoid duplicates (same color from different paths)
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(srcPath, destPath);
                totalImages++;
            }

            urls.push(CDN_BASE + destFilename);
        }

        if (urls.length > 0) {
            // Dedupe URLs
            const uniqueUrls = [...new Set(urls)];
            dbUpdates.push({ id: product.productId, urls: uniqueUrls });
        }
    }

    console.log(`\n📂 Staged ${totalImages} images for upload.`);

    // 4. rsync Upload
    console.log('\n📤 Uploading to VPS...');
    try {
        // Fix permissions first
        execSync(`ssh ${VPS_USER}@${VPS_IP} "sudo chmod 775 ${VPS_PATH} && sudo chown ${VPS_USER}:www-data ${VPS_PATH}"`, { stdio: 'inherit' });

        execSync(`rsync -avz --progress ${STAGE_DIR}/ ${VPS_USER}@${VPS_IP}:${VPS_PATH}/`, { stdio: 'inherit' });

        // Reset permissions
        execSync(`ssh ${VPS_USER}@${VPS_IP} "sudo chown -R www-data:www-data ${VPS_PATH} && sudo chmod -R 755 ${VPS_PATH}"`, { stdio: 'inherit' });
        console.log('   ✅ Upload complete.');
    } catch (e) {
        console.error('   ❌ Upload failed:', e);
        return;
    }

    // 5. Update Database (images ARRAY)
    console.log('\n📝 Updating database...');
    let successCount = 0;

    for (const update of dbUpdates) {
        const { error } = await supabase
            .from('products')
            .update({ images: update.urls })
            .eq('id', update.id);

        if (error) {
            console.error(`   ❌ Failed ${update.id}: ${error.message}`);
        } else {
            successCount++;
        }
    }

    console.log(`\n✅ Updated ${successCount}/${dbUpdates.length} products with gallery images.`);
    console.log('🎉 Gallery Deployment Complete!');
}

deploy();
