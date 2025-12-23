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

// Map of Partial Name -> CDN Filename
const updates = [
  { name: 'Elden Ring', filename: 'elden-ring.avif' },
  { name: 'Fifa 23', filename: 'fifa-23.avif' },
  {
    name: 'Call Of Duty Modern Warfare 3',
    filename: 'call-of-duty-modern-warfare-3.avif',
  },
  { name: 'Assassins Creed Mirage', filename: 'assassins-creed-mirage.avif' },
  { name: 'God Of War Ragnarok', filename: 'god-of-war-ragnarok.avif' },
];

async function updatePhase1Parents() {
  console.log('🚀 Updating Phase 1 Patents...');

  for (const item of updates) {
    const cdnUrl = `https://cdn.ogabassey.com/products/gaming/${item.filename}`;

    // Find the parent by name
    const { data: products, error: searchError } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', item.name) // Use ILIKE for partial/case-insensitive match
      .eq('is_parent', true);

    if (searchError) {
      console.error(`❌ Error searching for ${item.name}:`, searchError);
      continue;
    }

    if (!products || products.length === 0) {
      console.error(`❌ Product not found: ${item.name}`);
      continue;
    }

    const product = products[0]; // Take the first match

    // Update its image
    const { error: updateError } = await supabase
      .from('products')
      .update({ images: [cdnUrl] })
      .eq('id', product.id);

    if (updateError) {
      console.error(`❌ Failed to update ${product.name}:`, updateError);
    } else {
      console.log(`✅ Updated ${product.name} -> ${cdnUrl}`);
    }
  }

  console.log('🎉 Phase 1 Update Complete.');
}

updatePhase1Parents();
