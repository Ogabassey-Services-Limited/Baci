import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VPS_IP = process.env.VPS_IP || '82.29.190.219';
const VPS_USER = process.env.VPS_USER || 'bassey';
const SSH_KEY = process.env.SSH_KEY_PATH || path.join(process.env.HOME || '~', '.ssh/id_ed25519');
const REMOTE_DIR = process.env.VPS_PATH || '/var/www/cdn/products';
const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://cdn.ogabassey.com/products';

const BRANDED_DIR = path.join(process.cwd(), 'gaming_branded_images');

async function deployGaming() {
    console.log('🚀 Starting Gaming Deployment...');

    // 1. Get List of Branded Images
    if (!fs.existsSync(BRANDED_DIR)) { console.error("No branded images dir!"); return; }
    const files = fs.readdirSync(BRANDED_DIR).filter(f => f.endsWith('.png'));
    console.log(`Found ${files.length} branded images.`);

    // 2. Fetch Gaming Products
    const { data: products, error: productsError } = await supabase.from('products').select('id, slug, name').eq('category', 'Video Games');

    if (productsError) {
        console.error('❌ Query failed:', productsError.message);
        process.exit(1);
    }

    if (!products) {
        console.error('❌ No products returned');
        process.exit(1);
    }

    const productMap = new Map(products.map(p => [p.slug, p]));

    const uploads = [];

    // 3. Match and Prepare
    for (const file of files) {
        const baseSlug = file.replace('.png', '');
        let product = productMap.get(baseSlug);

        if (!product) {
            // Try with -ps5 suffix
            product = productMap.get(`${baseSlug}-ps5`);
        }

        if (product) {
            console.log(`✅ MATCH: ${baseSlug} -> ${product.name} (${product.id})`);
            uploads.push({
                localPath: path.join(BRANDED_DIR, file),
                remoteName: `${product.id}.png`,
                productId: product.id
            });
        } else {
            console.warn(`⚠️  No match for ${baseSlug}`);
        }
    }

    if (uploads.length === 0) { console.log("No matches to upload."); return; }

    // 4. Upload to VPS (Bulk)
    // Create local temp dir or upload individually? Individually is safer for reporting.
    // Or upload all to /home/bassey/gaming_uploads/ and then move.
    console.log("Uploading files...");
    const uploadCmds = uploads.map(u => `scp -i ${SSH_KEY} -o StrictHostKeyChecking=no "${u.localPath}" ${VPS_USER}@${VPS_IP}:/home/bassey/${u.remoteName}`);

    // Using simple loop for sequential upload
    for (let i = 0; i < uploads.length; i++) {
        const u = uploads[i];
        try {
            console.log(`[${i + 1}/${uploads.length}] Uploading ${u.remoteName}...`);
            await execAsync(`scp -i ${SSH_KEY} -o StrictHostKeyChecking=no "${u.localPath}" ${VPS_USER}@${VPS_IP}:/home/bassey/${u.remoteName}`);

            // 5. Update Database immediately after upload?
            // Better to move first.
        } catch (e) {
            console.error(`Upload failed for ${u.remoteName}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // 6. Move files on VPS and set correct permissions
    console.log("Moving files to content directory and fixing permissions...");
    // Use umask 022 to ensure correct permissions, then move and chmod
    const moveCmd = `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "umask 022 && mv /home/bassey/*.png ${REMOTE_DIR}/ 2>/dev/null; chmod 644 ${REMOTE_DIR}/*.png 2>/dev/null || echo 'Some files already moved'"`;
    try {
        await execAsync(moveCmd);
        console.log("Files moved and permissions set (644).");
    } catch (e) {
        console.error("Move command issue:", e instanceof Error ? e.message : String(e));
        // Continue to DB update anyway as move might have partially succeeded
    }

    // 7. Update Database
    console.log("Updating Database Records...");
    for (const u of uploads) {
        const publicUrl = `${CDN_BASE_URL}/${u.remoteName}`;
        const { error } = await supabase
            .from('products')
            .update({ images: [publicUrl] })
            .eq('id', u.productId);

        if (error) console.error(`DB Update failed for ${u.productId}:`, error.message);
        else console.log(`   Updated: ${publicUrl}`);
    }

    console.log("Gaming Deployment Complete!");
}

deployGaming();
