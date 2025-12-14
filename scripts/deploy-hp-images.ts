import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSafe } from './lib/exec-safe';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VPS_USER = 'bassey';
const VPS_IP = '82.29.190.219';
const CDN_PATH = '/home/bassey/hp_uploads';
const LOCAL_DIR = 'hp_downloaded_images';

const matches = JSON.parse(fs.readFileSync('hp_matched_images.json', 'utf-8'));

async function deploy() {
    console.log(`🚀 Starting deployment for ${matches.length} verified products...`);

    for (const match of matches) {
        const id = match.supabaseId;
        const localFilename = `branded_${id}.png`;
        const localPath = path.join(LOCAL_DIR, localFilename);
        const remoteFilename = `${id}.png`; // storing as ID.png

        // 1. Check if file exists
        if (!fs.existsSync(localPath)) {
            console.warn(`⚠️ File not found (skipping): ${localPath}`);
            // Attempt to use unbranded if branded missing? No, branded required.
            continue;
        }

        // 2. Upload to VPS
        console.log(`📤 Uploading: ${match.ourProductName}`);
        try {
            await execSafe('scp', [localPath, `${VPS_USER}@${VPS_IP}:${CDN_PATH}/${remoteFilename}`]);
            console.log(`   ✅ Uploaded to CDN: ${remoteFilename}`);
        } catch (err) {
            console.error(`   ❌ Upload failed: ${err}`);
            continue;
        }

        // 3. Update Supabase
        const cdnUrl = `https://cdn.ogabassey.com/products/${remoteFilename}`;
        console.log(`🔄 Updating DB...`);

        const { error } = await supabase
            .from('products')
            .update({
                images: [cdnUrl],
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error(`   ❌ DB Update failed: ${error.message}`);
        } else {
            console.log(`   ✅ DB Updated!`);
        }
    }

    console.log(`\n🎉 Deployment Complete!`);
}

deploy();
