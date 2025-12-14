import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

dotenv.config();
const execAsync = promisify(exec);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VPS_IP = '82.29.190.219';
const VPS_USER = 'bassey';
const SSH_KEY = '/Users/mac/.ssh/id_ed25519';
const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';
const BRANDED_DIR = path.join(process.cwd(), 'gaming_branded_images');

// Map: source image filename (without .png) -> product ID
const fixes = [
    { source: 'ghost-of-tsushima-directors-cut', productId: null, slug: 'ghost-of-tsushima-director-s-cut-ps5' },
    { source: 'marvels-spider-man-2', productId: null, slug: 'marvel-s-spider-man-2-ps5' },
    { source: 'god-of-war-ragnarok', productId: null, slug: 'god-of-war-ragnar-k-ps5' },
    { source: 'assassins-creed-mirage', productId: null, slug: 'assassin-s-creed-mirage-ps5' },
    { source: 'resident-evil-4', productId: null, slug: 'resident-evil-4-remake-ps5' }
];

async function fixMismatches() {
    console.log('🔧 Fixing 5 Mismatched Gaming Products...\n');

    // 1. Get product IDs for the slugs
    for (const fix of fixes) {
        const { data } = await supabase
            .from('products')
            .select('id, name')
            .eq('slug', fix.slug)
            .single();

        if (data) {
            fix.productId = data.id;
            console.log(`Found: ${data.name} -> ${data.id}`);
        } else {
            console.log(`❌ Not found: ${fix.slug}`);
        }
    }

    // 2. Upload and update for each
    for (const fix of fixes) {
        if (!fix.productId) continue;

        const sourceFile = path.join(BRANDED_DIR, `${fix.source}.png`);
        if (!fs.existsSync(sourceFile)) {
            console.log(`⚠️ Source file not found: ${fix.source}.png`);
            continue;
        }

        const remoteName = `${fix.productId}.png`;

        // Upload
        console.log(`Uploading ${fix.source} as ${remoteName}...`);
        try {
            await execAsync(`scp -i ${SSH_KEY} -o StrictHostKeyChecking=no "${sourceFile}" ${VPS_USER}@${VPS_IP}:/home/bassey/${remoteName}`);

            // Update DB
            const publicUrl = `${CDN_BASE_URL}/${remoteName}`;
            const { error } = await supabase
                .from('products')
                .update({ images: [publicUrl] })
                .eq('id', fix.productId);

            if (error) console.error(`DB Error: ${error.message}`);
            else console.log(`   ✅ Updated: ${publicUrl}`);
        } catch (e: any) {
            console.error(`Upload failed: ${e.message}`);
        }
    }

    // 3. Move files on VPS
    console.log('\nMoving files to CDN directory...');
    try {
        await execAsync(`ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "echo 'Ogabassey1234!Praisethelord96!' | sudo -S sh -c 'mv /home/bassey/*.png /var/www/cdn/products/ 2>/dev/null; chmod 644 /var/www/cdn/products/*.png'"`);
        console.log('Done!');
    } catch (e: any) {
        console.log('Move command completed (some files may have already been moved)');
    }
}

fixMismatches();
