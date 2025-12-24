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

// Map filenames to Product Names
const PRODUCT_UPDATE_MAP = [
  { file: 'fc25.avif', name: 'FC25', isExact: true },
  { file: 'fc26.avif', name: 'FC26', isExact: true },
  { file: 'hogwarts-legacy.avif', name: 'Hogwarts Legacy', isExact: false },
  { file: 'mk1.avif', name: 'Mortal Kombat 1', isExact: false },
  { file: 'cyberpunk-2077.avif', name: 'Cyberpunk 2077', isExact: false },
  { file: 'nba-2k25.avif', name: 'NBA 26', isExact: false },
  {
    file: 'mk11-ultimate.avif',
    name: 'Mortal Kombat 11 Ultimate',
    isExact: false,
  },
];

const CDN_BASE_URL = 'https://cdn.ogabassey.com/products/gaming/';

async function updateUrls() {
  console.log('🚀 Updating Gaming Product URLs to Hostinger CDN...');

  for (const item of PRODUCT_UPDATE_MAP) {
    const fullUrl = `${CDN_BASE_URL}${item.file}`;

    let query = supabase
      .from('products')
      .update({ images: [fullUrl] })
      .eq('is_parent', true);

    if (item.isExact) {
      query = query.eq('name', item.name);
    } else if (item.name === 'Mortal Kombat 1') {
      // Avoid matching "Mortal Kombat 11"
      query = query
        .ilike('name', 'Mortal Kombat 1%')
        .not('name', 'ilike', '%Ultimate%');
    } else {
      query = query.ilike('name', `%${item.name}%`);
    }

    const { error } = await query;

    if (error) {
      console.error(`   ❌ Failed to update ${item.name}:`, error.message);
    } else {
      console.log(`   ✅ Updated ${item.name} -> ${fullUrl}`);
    }
  }
}

updateUrls();
