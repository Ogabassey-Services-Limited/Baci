import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySmartWatchSpecs() {
  console.log('Verifying Smartwatch Specs...\n');

  // Get all smartwatch products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('category.ilike.%smartwatch%,category.ilike.%wearable%,category.ilike.%watch%,name.ilike.%watch%')
    .order('name')
    .limit(25);

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return;
  }

  console.log(`Found ${products.length} smartwatch products\n`);

  let withSpecs = 0;
  let withoutSpecs = 0;

  for (const product of products) {
    const { data: specs, error: specsError } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (specs) {
      withSpecs++;
      console.log(`✓ ${product.name}`);
      console.log(`  Display: ${specs.screen_size_inches}" ${specs.display_type} (${specs.display_resolution})`);
      console.log(`  Chipset: ${specs.chipset || 'N/A'}`);
      console.log(`  Storage: ${specs.storage_gb}GB`);
      console.log(`  Battery: ${specs.battery_mah}mAh`);
      console.log(`  Weight: ${specs.weight_g}g`);
      console.log(`  GPS: ${specs.positioning || 'N/A'}`);
      console.log(`  Bluetooth: ${specs.bluetooth_version}`);
      console.log(`  Sensors: ${specs.sensors || 'N/A'}`);
      console.log(`  Colors: ${specs.available_colors || 'N/A'}`);
      console.log();
    } else {
      withoutSpecs++;
      console.log(`✗ ${product.name} - NO SPECS`);
      console.log();
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Products with specs: ${withSpecs}`);
  console.log(`Products without specs: ${withoutSpecs}`);
  console.log(`Total: ${products.length}`);
}

verifySmartWatchSpecs().catch(console.error);
