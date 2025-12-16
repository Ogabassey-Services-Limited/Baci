/**
 * Populate product_key_specs for TV products using only existing columns
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TVSpec {
  product_id: string;
  screen_size_inches: number;
  display_type: string;
  display_resolution: string;
  refresh_rate_hz: number;
}

function parseScreenSize(name: string): number {
  const match = name.match(/(\d+)"/);
  return match ? parseInt(match[1]) : 50;
}

function determineSpecs(product: any): TVSpec {
  const name = product.name.toUpperCase();
  const screenSize = parseScreenSize(product.name);

  let displayType = 'LED';
  let displayResolution = 'Full HD';
  let refreshRate = 60;

  // Determine display type from name
  if (name.includes('OLED')) {
    displayType = 'OLED';
    displayResolution = '4K UHD';
    refreshRate = 120;
  } else if (name.includes('NEO QLED')) {
    displayType = 'Neo QLED';
    displayResolution = '4K UHD';
    refreshRate = 120;
  } else if (name.includes('QLED')) {
    displayType = 'QLED';
    displayResolution = '4K UHD';
    refreshRate = screenSize >= 55 ? 120 : 60;
  } else if (name.includes('QNED')) {
    displayType = 'QNED';
    displayResolution = '4K UHD';
    refreshRate = 120;
  } else if (name.includes('NANO CELL') || name.includes('NANOCELL')) {
    displayType = 'NanoCell';
    if (name.includes('8K')) {
      displayResolution = '8K UHD';
      refreshRate = 120;
    } else {
      displayResolution = '4K UHD';
      refreshRate = 100;
    }
  } else if (name.includes('CRYSTAL UHD') || name.includes('CRYSTAL')) {
    displayType = 'Crystal UHD';
    displayResolution = '4K UHD';
    refreshRate = 60;
  } else if (name.includes('UHD') || name.includes('4K')) {
    displayType = 'LED';
    displayResolution = '4K UHD';
    refreshRate = 60;
  } else if (name.includes('PREMIUM UHD')) {
    displayType = 'LED';
    displayResolution = '4K UHD';
    refreshRate = 60;
  } else {
    // Standard HD TV
    displayResolution = 'Full HD';
    refreshRate = 60;
  }

  return {
    product_id: product.id,
    screen_size_inches: screenSize,
    display_type: displayType,
    display_resolution: displayResolution,
    refresh_rate_hz: refreshRate,
  };
}

async function main() {
  console.log('🔍 Fetching TV products without specs...\n');

  // Get all TV products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%tv%')
    .order('brand', { ascending: true })
    .order('name', { ascending: true });

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return;
  }

  console.log(`Found ${products?.length || 0} TV products\n`);

  // Filter out those that already have specs
  const productsToPopulate: any[] = [];
  for (const product of products || []) {
    const { data: existingSpecs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .single();

    if (!existingSpecs) {
      productsToPopulate.push(product);
    }
  }

  console.log(`${productsToPopulate.length} TVs need specs\n`);
  console.log('📝 Generating and inserting specs...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const product of productsToPopulate) {
    const specs = determineSpecs(product);

    console.log(`Processing: ${product.brand} - ${product.name}`);
    console.log(`  Screen: ${specs.screen_size_inches}" ${specs.display_type}`);
    console.log(`  Resolution: ${specs.display_resolution} @ ${specs.refresh_rate_hz}Hz`);

    const { error } = await supabase
      .from('product_key_specs')
      .insert(specs);

    if (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
      errorCount++;
    } else {
      console.log(`  ✅ Success\n`);
      successCount++;
    }
  }

  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total TVs processed: ${productsToPopulate.length}`);
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`Coverage: ${((successCount / Math.max(productsToPopulate.length, 1)) * 100).toFixed(1)}%`);
}

main().catch(console.error);
