
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const REMOTE_DIR = '/home/bassey/baci-cdn/public/core-assets/products/gaming/';
const CDN_BASE_URL = 'https://cdn.ogabassey.com/core-assets/products/gaming/';
const LOCAL_DIR = 'public/game-covers';

const BATCH_A_PART_2 = [
    { id: 'a884c157-686e-4996-ba4f-69850adfe786', name: 'GTA Trilogy', filename: 'gta-trilogy.avif' },
    { id: '7b344acc-c3df-47ee-b557-ad9a0c5af748', name: 'Dragon Ball Kakarot', filename: 'dragon-ball-kakarot.avif' },
    { id: '0992b416-1994-4f45-9644-d9c7ed1ff604', name: 'Fast & Furious Spy Racers', filename: 'fast-furious-spy-racers.avif' },
    { id: 'abc7fe1e-d152-4b5f-b9bb-235538a723ff', name: 'Babylons Fall', filename: 'babylons-fall.avif' },
    { id: 'c4fbc544-3e55-45c3-9d8c-d74e991399ec', name: 'F1 2021', filename: 'f1-2021.avif' },
];

async function uploadBatchAPart2() {
    console.log('🚀 Starting Batch A (Part 2) Upload & Update...');

    for (const product of BATCH_A_PART_2) {
        const localPath = path.join(LOCAL_DIR, product.filename);
        const remoteUrl = `${CDN_BASE_URL}${product.filename}`;

        console.log(`Processing ${product.name}...`);

        // 1. Upload via SCP
        try {
            console.log(`   📤 Uploading ${product.filename} to ${REMOTE_DIR}...`);
            await execPromise(`scp ${localPath} bassey@82.29.190.219:${REMOTE_DIR}`);
            console.log(`   ✅ Upload successful.`);
        } catch (error: any) {
            console.error(`   ❌ SCP Failed for ${product.name}:`, error.message);
            continue;
        }

        // 2. Update Supabase
        try {
            console.log(`   🔄 Updating Database ID ${product.id} with URL: ${remoteUrl}`);
            const { error } = await supabase
                .from('products')
                .update({ images: [remoteUrl] })
                .eq('id', product.id);

            if (error) {
                console.error(`   ❌ Supabase Update Failed:`, error.message);
            } else {
                console.log(`   ✅ Database Updated.`);
            }
        } catch (err: any) {
            console.error(`   ❌ Update Error:`, err.message);
        }
    }

    // 3. Fix Permissions
    try {
        console.log('   🔒 Fixing permissions on server...');
        await execPromise(`ssh bassey@82.29.190.219 "chmod 644 ${REMOTE_DIR}*.avif"`);
        console.log('   ✅ Permissions updated.');
    } catch (error: any) {
        console.error('   ❌ Failed to update permissions:', error.message);
    }

    console.log('\n🎉 Batch A (Part 2) Complete!');
}

uploadBatchAPart2();
