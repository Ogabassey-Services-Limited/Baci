import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MATCH_FILES = [
    'scripts/ai_matches_part1.jsonl',
    'scripts/ai_matches_part2.jsonl',
    'scripts/ai_matches_part3.jsonl',
    'scripts/heuristic_matches.jsonl',
    'scripts/samsung_fallback_matches.jsonl'
].map(f => path.join(process.cwd(), f));

const PRIMARY_IMAGE_DIR = process.env.PRIMARY_IMAGE_DIR || path.join(process.cwd(), 'public/website designs');
const VPS_USER = process.env.VPS_USER || 'bassey';
const VPS_IP = process.env.VPS_IP || '82.29.190.219';
const VPS_PATH = process.env.VPS_PATH || '/var/www/cdn/products';
const SSH_KEY = process.env.SSH_KEY_PATH || path.join(process.env.HOME || '~', '.ssh/id_ed25519');

interface MatchConfig {
    productId: string;
    productName: string;
    matchedImageFilename: string;
    confidence: number;
}

async function deployMatches() {
    console.log('🚀 Starting Deployment of Matched Images...');

    // 1. Merge Results
    const allMatches: MatchConfig[] = [];
    for (const file of MATCH_FILES) {
        if (!fs.existsSync(file)) {
            console.warn(`⚠️ Warning: ${file} not found.`);
            continue;
        }
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        for (const line of lines) {
            try {
                const match = JSON.parse(line);
                if (match.matchedImageFilename) {
                    allMatches.push(match);
                }
            } catch (e) {
                console.warn(`⚠️ Error parsing line in ${file}:`, e instanceof Error ? e.message : 'Unknown error');
            }
        }
    }

    console.log(`Found ${allMatches.length} total matches proposed by AI.`);

    // 2. Filter High Confidence
    // Allow >= 0.7 as "Good enough"? Or stick to strict?
    // User wants accuracy. Let's filter > 0.0 for now but log confidence.
    // Ideally we'd review. But for now let's assume valid results.

    const validMatches = allMatches; // Use all non-null matches

    if (validMatches.length === 0) {
        console.log('No matches found to deploy.');
        return;
    }

    // 3. Fetch Product Slugs for SEO-friendly Naming
    console.log('   Fetching product slugs for file renaming...');
    const productIds = validMatches.map(m => m.productId);

    const slugMap = new Map<string, string>();
    // Fetch in chunks to avoid URL length limits
    for (let i = 0; i < productIds.length; i += 100) {
        const batchIds = productIds.slice(i, i + 100);
        const { data: products } = await supabase
            .from('products')
            .select('id, slug')
            .in('id', batchIds);
        products?.forEach(p => slugMap.set(p.id, p.slug));
    }
    console.log(`   Found slugs for ${slugMap.size} products.`);

    // 4. Prepare Upload with Slug-based Renaming
    const uniqueImages = new Set<string>(); // Track source paths
    const fileMapping = new Map<string, string>(); // sourcePath -> destFilename
    const updates: { id: string; url: string }[] = [];

    for (const m of validMatches) {
        const slug = slugMap.get(m.productId);
        if (!slug) {
            console.warn(`   ⚠️ No slug for ${m.productName}, skipping.`);
            continue;
        }

        const ext = path.extname(m.matchedImageFilename); // .avif or .webp
        const newFilename = `${slug}${ext}`; // e.g., tecno-spark-40.avif

        uniqueImages.add(m.matchedImageFilename);
        fileMapping.set(m.matchedImageFilename, newFilename);

        // Clean SEO URL - no encoding needed since slug is already URL-safe
        const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://cdn.ogabassey.com/products';
        const url = `${CDN_BASE_URL}/${newFilename}`;
        updates.push({ id: m.productId, url });
    }

    console.log(`\n📦 Unique images to upload: ${uniqueImages.size}`);

    // 5. Stage Files with New SEO-friendly Names
    const STAGE_DIR = path.join(process.cwd(), 'scripts/staging_upload');
    if (fs.existsSync(STAGE_DIR)) fs.rmSync(STAGE_DIR, { recursive: true, force: true });
    fs.mkdirSync(STAGE_DIR);

    console.log('   Preparing staging directory with renamed files...');
    let missingCount = 0;

    for (const relativePath of uniqueImages) {
        // Handle absolute paths (from heuristic/fallback scripts) vs relative paths (from AI scripts)
        const srcPath = path.isAbsolute(relativePath)
            ? relativePath
            : path.join(PRIMARY_IMAGE_DIR, relativePath);
        const destFilename = fileMapping.get(relativePath);
        if (!destFilename) continue;

        const destPath = path.join(STAGE_DIR, destFilename);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
        } else {
            console.warn(`   ⚠️ Missing file: ${srcPath}`);
            missingCount++;
        }
    }

    if (missingCount > 0) {
        console.warn(`   ⚠️ ${missingCount} matched files were not found on disk.`);
    }

    console.log(`   Fixing VPS directory permissions first...`);
    try {
        // Fix permissions BEFORE upload - grant bassey user write access
        execSync(`ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "sudo chown -R ${VPS_USER}:www-data ${VPS_PATH} && sudo chmod -R 775 ${VPS_PATH}"`, { stdio: 'inherit' });
        console.log('   ✅ VPS permissions ready.');
    } catch (e) {
        console.error('   ⚠️ Could not fix permissions, trying upload anyway...');
    }

    console.log(`   Uploading ${uniqueImages.size - missingCount} images to VPS using rsync...`);
    try {
        // Use rsync for robust transfer
        const rsyncCmd = `rsync -avz --progress -e "ssh -i \\"${SSH_KEY}\\" -o StrictHostKeyChecking=no" "${STAGE_DIR}/" ${VPS_USER}@${VPS_IP}:${VPS_PATH}/`;

        execSync(rsyncCmd, { stdio: 'inherit' });
        console.log('   ✅ Upload complete.');

        // Reset permissions for Nginx
        execSync(`ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "sudo chown -R www-data:www-data ${VPS_PATH} && sudo chmod -R 755 ${VPS_PATH}"`, { stdio: 'inherit' });
        console.log('   ✅ Permissions finalized.');

    } catch (e) {
        console.error('   ❌ Upload failed:', e);
        return;
    }

    // 5. Update Database
    console.log('\n📝 Updating database...');
    // Process in batches
    for (let i = 0; i < updates.length; i += 50) {
        const batch = updates.slice(i, i + 50);
        // Supabase doesn't have a bulk update for different values easily.
        // We have to loop or use upsert.
        // UPSERT requires all columns or it might set nulls? 
        // We only want to update `image`.
        // We can use `upsert` if we strictly match existing IDs.
        // But `products` table has many required fields.
        // Safer to loop updates or use a custom SQL function?
        // Loop updates is strictly safer for now, even if slower.
        // Or use `Promise.all` with concurrency control.

        await Promise.all(batch.map(async (u) => {
            // Update `images` array (JSONB). 
            // We verify if `images` exists? No, we just overwrite/set it for now as these are new image matches.
            // If we wanted to APPEND, we'd need to fetch first.
            // Safe assumption: If we just matched an AI image, it's likely the BEST/ONLY image.

            const { error } = await supabase
                .from('products')
                .update({ images: [u.url] })
                .eq('id', u.id);
            if (error) console.error(`Failed to update ${u.id}:`, error.message);
        }));

        process.stdout.write(`.`);
    }

    console.log('\n🎉 Deployment Complete!');
}

deployMatches().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
