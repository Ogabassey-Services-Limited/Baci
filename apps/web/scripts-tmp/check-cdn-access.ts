import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkCdn() {
  console.log('Connecting to Supabase Storage...');

  // List buckets
  const { data: buckets, error: bucketsError } =
    await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('Failed to list buckets:', bucketsError);
    return;
  }

  console.log('✅ Connected! Available buckets:');
  for (const b of buckets) {
    console.log(` - ${b.name}`);
  }

  // Check 'images' bucket content
  const { data: files, error: filesError } = await supabase.storage
    .from('images')
    .list('', { limit: 5 });

  if (filesError) {
    console.log('Could not list files in "images":', filesError.message);
  } else {
    console.log('\nFiles in "images" bucket:');
    for (const f of files) {
      console.log(` - ${f.name}`);
    }
  }

  // Check specifically for product-images
  const productImages = buckets.find((b) => b.name === 'product-images');
  if (productImages) {
    console.log('\n✅ "product-images" bucket found. I have full access.');
  } else {
    console.log(
      '\n⚠️ "product-images" bucket NOT found. I may need to create it.'
    );
  }
}

checkCdn();
