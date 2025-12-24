import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
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

const BATCH_A = [
  {
    id: '41ee6609-6ddb-49a6-9b65-2bee3379e41d',
    name: 'Dark Souls Remastered',
    filename: 'dark-souls-remastered.avif',
  },
  {
    id: '916b8e95-df37-4671-a211-2b7778824feb',
    name: 'Call of Duty Cold War',
    filename: 'call-of-duty-cold-war.avif',
  },
  {
    id: 'd0dc6c45-435d-4ac3-8ff4-e12b642bff5a',
    name: 'F1 2024',
    filename: 'f1-2024.avif',
  },
  {
    id: '47d518e9-2432-4fa2-96b8-63a7881c6d6f',
    name: 'Dirt 5',
    filename: 'dirt-5.avif',
  },
  {
    id: '94d7e42b-82d0-4eac-8aee-bf5b058012ec',
    name: 'FarCry 6',
    filename: 'farcry-6.avif',
  },
];

async function uploadBatchA() {
  console.log('🚀 Starting Batch A Upload & Update...');

  for (const product of BATCH_A) {
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
      console.log(
        `   🔄 Updating Database ID ${product.id} with URL: ${remoteUrl}`
      );
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

  console.log('\n🎉 Batch A (Part 1) Complete!');
}

uploadBatchA();
