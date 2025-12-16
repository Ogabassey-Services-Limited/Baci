import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log('Smartwatch Specs Verification Report\n');
  console.log('='.repeat(80));

  // Get all smartwatch specs by querying products first
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('category.ilike.%Smartwatch%,category.ilike.%Wearable%,category.ilike.%Fitness%,name.ilike.%Watch%,name.ilike.%Band%');

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return;
  }

  // Get specs for these products
  const productIds = products?.map(p => p.id) || [];

  const { data: specs, error } = await supabase
    .from('product_key_specs')
    .select(`
      id,
      product_id,
      screen_size_inches,
      display_type,
      display_resolution,
      battery_mah,
      positioning,
      bluetooth_version,
      chipset,
      weight_g,
      storage_gb,
      ram_gb,
      has_nfc,
      ip_rating,
      sensors,
      available_colors
    `)
    .in('product_id', productIds);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Create a map of product_id to product data
  const productMap = new Map(products?.map(p => [p.id, p]) || []);

  // Combine specs with product data
  const specsWithProducts = specs?.map(spec => ({
    spec,
    product: productMap.get(spec.product_id)
  })).filter(item => item.product) || [];

  console.log(`\nTotal smartwatch specs in database: ${specs?.length || 0}\n`);
  console.log('='.repeat(80));

  // Group by brand
  const brandGroups: Record<string, any[]> = {};

  for (const { spec, product } of specsWithProducts) {
    const brand = product?.brand || 'Unknown';

    if (!brandGroups[brand]) {
      brandGroups[brand] = [];
    }
    brandGroups[brand].push({ spec, product });
  }

  console.log('\nBrand Summary:\n');
  Object.entries(brandGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([brand, items]) => {
      console.log(`${brand}: ${items.length} product(s) with specs`);
    });

  console.log('\n' + '='.repeat(80));
  console.log('\nDetailed Specs (First 10):\n');

  for (const { spec, product } of specsWithProducts.slice(0, 10)) {
    console.log(`Product: ${product?.name}`);
    console.log(`  Brand: ${product?.brand}`);
    console.log(`  Category: ${product?.category}`);
    console.log(`  Display: ${spec.screen_size_inches}" ${spec.display_type} (${spec.display_resolution})`);
    console.log(`  Battery: ${spec.battery_mah || 'N/A'}mAh`);
    console.log(`  Positioning: ${spec.positioning || 'None'}`);
    console.log(`  Bluetooth: ${spec.bluetooth_version}`);
    console.log(`  Chipset: ${spec.chipset}`);
    console.log(`  Weight: ${spec.weight_g}g`);
    console.log(`  Storage: ${spec.storage_gb}GB | RAM: ${spec.ram_gb || 'N/A'}GB`);
    console.log(`  NFC: ${spec.has_nfc ? 'Yes' : 'No'}`);
    console.log(`  IP Rating: ${spec.ip_rating}`);
    console.log(`  Sensors: ${spec.sensors}`);
    console.log(`  Colors: ${spec.available_colors}`);
    console.log();
  }

  // Check for products without specs
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, category, brand')
    .or('category.ilike.%watch%,category.ilike.%wearable%,category.ilike.%fitness%,name.ilike.%watch%,name.ilike.%band%');

  const productsWithSpecs = new Set(specs?.map(s => (s.products as any).name) || []);
  const productsWithoutSpecs = allProducts?.filter(p => {
    // Filter out video games
    if (p.name.toLowerCase().includes('overwatch') ||
        p.name.toLowerCase().includes('watch dogs')) {
      return false;
    }
    return !productsWithSpecs.has(p.name);
  }) || [];

  console.log('='.repeat(80));
  console.log('\nProducts Without Specs:\n');
  console.log(`Total: ${productsWithoutSpecs.length}`);

  if (productsWithoutSpecs.length > 0) {
    console.log('\nMissing specs for:');
    productsWithoutSpecs.slice(0, 20).forEach(p => {
      console.log(`  - ${p.name} (${p.brand}) [${p.category}]`);
    });

    if (productsWithoutSpecs.length > 20) {
      console.log(`  ... and ${productsWithoutSpecs.length - 20} more`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\nSummary:');
  console.log(`  Products with specs: ${specs?.length || 0}`);
  console.log(`  Products without specs: ${productsWithoutSpecs.length}`);
  console.log(`  Completion: ${((specs?.length || 0) / ((specs?.length || 0) + productsWithoutSpecs.length) * 100).toFixed(1)}%`);
}

verify().catch(console.error);
