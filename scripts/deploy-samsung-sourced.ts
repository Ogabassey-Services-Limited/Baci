
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VPS_USER = process.env.VPS_USER || 'bassey';
const VPS_IP = process.env.VPS_IP || '82.29.190.219';
const VPS_PATH = process.env.VPS_PATH || '/var/www/cdn/products';
const SSH_KEY = process.env.SSH_KEY_PATH || path.join(process.env.HOME || '~', '.ssh/id_ed25519');
const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';

const SOURCE_DIRS = [
    'samsung_jumia_v2',      // Priority 1: Latest Jumia scrape
    'samsung_mobile_images', // Priority 2: Official Mobile/Watch
    'samsung_tv_images',     // Priority 3: Generic High-Res TV
    'samsung_jumia_images'   // Priority 4: Earlier Jumia scrape
];

async function run() {
    console.log("🚀 Starting Samsung Deployment...");

    const STAGE_DIR = 'samsung_deploy_stage';
    if (fs.existsSync(STAGE_DIR)) fs.rmSync(STAGE_DIR, { recursive: true, force: true });
    fs.mkdirSync(STAGE_DIR);

    const deployedFiles = new Map<string, string>(); // slug -> final_url

    // 1. Gather Images
    for (const dir of SOURCE_DIRS) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f => !f.includes('_raw')); // Skip raw downloads
        for (const file of files) {
            const slug = file.replace('.jpg', '').replace('.png', '').replace('.avif', '').replace('.webp', '');

            // Priority Check: If already have this slug from a higher priority dir, skip.
            if (deployedFiles.has(slug)) continue;

            const src = path.join(dir, file);
            const dest = path.join(STAGE_DIR, file);
            fs.copyFileSync(src, dest);

            deployedFiles.set(slug, `${CDN_BASE_URL}/${file}`);
        }
    }

    console.log(`📦 Staged ${deployedFiles.size} unique images for upload.`);

    if (deployedFiles.size === 0) {
        console.log("No images to deploy.");
        return;
    }

    // 2. Upload to VPS
    console.log("☁️ Uploading to VPS...");
    try {
        // Fix perms
        execSync(`ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "sudo chown -R ${VPS_USER}:www-data ${VPS_PATH} && sudo chmod -R 775 ${VPS_PATH}"`);

        // Rsync
        execSync(`rsync -avz --progress -e "ssh -i \\"${SSH_KEY}\\" -o StrictHostKeyChecking=no" "${STAGE_DIR}/" ${VPS_USER}@${VPS_IP}:${VPS_PATH}/`);

        // Reset perms
        execSync(`ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "sudo chown -R www-data:www-data ${VPS_PATH} && sudo chmod -R 755 ${VPS_PATH}"`);
        console.log("✅ Upload Successful.");
    } catch (e) {
        console.error("❌ Upload Failed:", e);
        return;
    }

    // 3. Update Database
    console.log("📝 Updating Database...");
    let updatedCount = 0;

    // Fetch product IDs for slugs to ensure matching
    const slugs = Array.from(deployedFiles.keys());
    const { data: products } = await supabase.from('products').select('id, slug').in('slug', slugs);

    if (products) {
        for (const p of products) {
            const url = deployedFiles.get(p.slug);
            if (!url) continue;

            const { error } = await supabase
                .from('products')
                .update({ images: [url] })
                .eq('id', p.id);

            if (error) console.error(`   ❌ Failed update ${p.slug}: ${error.message}`);
            else updatedCount++;
        }
    }

    console.log(`🎉 Updated ${updatedCount} products in DB.`);
}

run().catch(console.error);
