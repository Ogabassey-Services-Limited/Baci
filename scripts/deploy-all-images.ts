import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const VPS_USER = 'bassey';
const VPS_IP = '82.29.190.219';
const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';
const REMOTE_DIR = '/var/www/cdn/products';
const TEMP_UPLOAD_DIR = '/home/bassey/bulk_uploads';
const SSH_KEY = '/Users/mac/.ssh/id_ed25519';

async function deployImages() {
    console.log('🚀 Starting Bulk Deployment...');

    const appleDir = path.join(process.cwd(), 'apple_downloaded_images');

    console.log('\n--- Processing Apple Images ---');

    const { data: appleProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, slug')
        .or('brand.ilike.Apple,name.ilike.%Apple%,name.ilike.%iPhone%,name.ilike.%MacBook%,name.ilike.%iPad%,name.ilike.%Watch%');

    if (productsError) {
        console.error('❌ Query failed:', productsError.message);
        process.exit(1);
    }

    if (!appleProducts) {
        console.error('❌ No products returned');
        process.exit(1);
    }

    console.log(`Found ${appleProducts.length} Apple products in DB.`);

    if (appleProducts.length === 0) return;

    const appleFiles = fs.readdirSync(appleDir).filter(f => f.startsWith('branded_') && f.endsWith('.png'));
    let uploads: { localPath: string, remoteName: string, productId: string }[] = [];

    const sshOpts = `-i ${SSH_KEY} -o StrictHostKeyChecking=no`;

    for (const file of appleFiles) {
        const cleanName = file.replace('branded_', '').toLowerCase();
        let bestMatch = null;
        let maxScore = 0;

        const candidates = appleProducts.filter(p => {
            const lowerName = p.name.toLowerCase();
            if (cleanName.includes('iphone') && !lowerName.includes('iphone')) return false;
            if (cleanName.includes('macbook') && !lowerName.includes('macbook')) return false;
            if (cleanName.includes('ipad') && !lowerName.includes('ipad')) return false;
            if (cleanName.includes('watch') && !lowerName.includes('watch')) return false;
            return true;
        });

        for (const p of candidates) {
            let score = 0;
            const pName = p.name.toLowerCase();

            if (cleanName.includes('iphone-17') && pName.includes('17')) score += 20;
            if (cleanName.includes('iphone-16') && pName.includes('16')) score += 20;
            if (cleanName.includes('iphone-16e') && pName.includes('16e')) score += 25;
            if (cleanName.includes('iphone-air') && pName.includes('iphone air')) score += 25;

            if (cleanName.includes('pro max') && pName.includes('pro max')) score += 10;
            else if (cleanName.includes('pro') && !cleanName.includes('max') && pName.includes('pro') && !pName.includes('max')) score += 10;

            if (cleanName.includes('ipad') && pName.includes('ipad')) {
                if (cleanName.includes('air') && pName.includes('air')) score += 15;
                if (cleanName.includes('pro') && pName.includes('pro')) score += 15;
                if (cleanName.includes('mini') && pName.includes('mini')) score += 15;
                if (cleanName.includes('10th') && (pName.includes('10th') || pName.includes('10.9'))) score += 15;
            }

            if (cleanName.includes('watch') && pName.includes('watch')) score += 10;
            if (cleanName.includes('s11') && (pName.includes('series 11') || pName.includes('series 10'))) score += 5;

            if (cleanName.includes('macbook-air') && pName.includes('air')) score += 15;
            if (cleanName.includes('m4') && pName.includes('m4')) score += 5;

            const colors = ['silver', 'titanium', 'orange', 'blue', 'white', 'black', 'gold', 'gray', 'midnight', 'starlight'];
            for (const color of colors) {
                if (cleanName.includes(color) && pName.includes(color)) score += 5;
            }

            if (score > maxScore) { maxScore = score; bestMatch = p; }
        }

        if (bestMatch && maxScore >= 15) {
            console.log(`✅ MATCH: ${file} -> ${bestMatch.name} (Score: ${maxScore})`);
            uploads.push({ localPath: path.join(appleDir, file), remoteName: `${bestMatch.id}.png`, productId: bestMatch.id });
        } else {
            console.log(`⚠️  NO MATCH: ${file} (Max Score: ${maxScore})`);
        }
    }

    if (uploads.length === 0) { console.log('No matches found.'); return; }

    console.log(`\nStarting Upload of ${uploads.length} files...`);

    try { await execAsync(`ssh ${sshOpts} ${VPS_USER}@${VPS_IP} "mkdir -p ${TEMP_UPLOAD_DIR}"`); } catch (e) { /* ignore */ }

    let successCount = 0;
    for (const item of uploads) {
        console.log(`Uploading ${item.remoteName}...`);
        try {
            await execAsync(`scp ${sshOpts} "${item.localPath}" ${VPS_USER}@${VPS_IP}:${TEMP_UPLOAD_DIR}/${item.remoteName}`);
            successCount++;
        } catch (e) { console.error(`Failed: ${item.remoteName}`); }
    }

    if (successCount === 0) { console.error("All uploads failed."); return; }

    console.log(`Uploaded ${successCount}/${uploads.length} files. Moving to CDN...`);
    try {
        await execAsync(`ssh ${sshOpts} ${VPS_USER}@${VPS_IP} "sudo mv ${TEMP_UPLOAD_DIR}/*.png ${REMOTE_DIR}/ && sudo chown -R bassey:bassey ${REMOTE_DIR} && sudo chmod 644 ${REMOTE_DIR}/*.png"`);
    } catch (e) { console.error("Move failed:", e.message); }

    console.log('\nUpdating Database...');
    for (const item of uploads) {
        const url = `${CDN_BASE_URL}/${item.remoteName}`;
        const { error } = await supabase.from('products').update({ images: [url] }).eq('id', item.productId);
        if (error) console.error(`DB failed: ${item.productId}`);
        else console.log(`Updated: ${item.productId}`);
    }

    console.log('🎉 Deployment Complete!');
}

deployImages().catch(console.error);
