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
  { name: 'GTa V', filename: 'gta-v.avif' }, // Matches DB name exactly
  {
    name: 'Assassins Creed Valhalla',
    filename: 'assassins-creed-valhalla.avif',
  },
  { name: 'FC24', filename: 'fc24.avif' },
];

async function updatePhase2Parents() {
  console.log('🚀 Updating Phase 2 Parents...');

  for (const item of updates) {
    const cdnUrl = `https://cdn.ogabassey.com/products/gaming/${item.filename}`;

    // Find the parent by name
    const { data: products, error: searchError } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', `%${item.name}%`) // Use ILIKE with wildcards for looser match on naming variations
      .eq('is_parent', true);

    if (searchError) {
      console.error(`❌ Error searching for ${item.name}:`, searchError);
      continue;
    }

    if (!products || products.length === 0) {
      console.error(`❌ Product not found: ${item.name}`);
      // Fallback for tricky names like "GTa V" if full match failed
      if (item.name === 'Grand Theft Auto V') {
        console.log('   Trying fallback "GTa V"...');
        // ... custom fallback logic if needed, but ilike with wildcard should catch it
      }
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

  console.log('🎉 Phase 2 Update Complete.');
}

updatePhase2Parents();
