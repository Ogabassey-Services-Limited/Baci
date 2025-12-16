import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aivqthbxdshhltbwipbr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyMiddleSection() {
  console.log('=== Verifying Middle Section Samsung Phones (Positions 30-44) ===\n');

  // Get all Samsung phones sorted
  const { data: allProducts, error } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%phone%')
    .ilike('brand', '%samsung%')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!allProducts) {
    console.log('No products found');
    return;
  }

  // Get middle section (positions 30-44)
  const middleProducts = allProducts.slice(30, 45);
  console.log(`Middle section products (30-44): ${middleProducts.length}\n`);

  // Check specs for each
  for (let i = 0; i < middleProducts.length; i++) {
    const product = middleProducts[i];
    const position = 30 + i;

    const { data: spec, error: specError } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .maybeSingle();

    const hasSpec = spec !== null;
    const statusIcon = hasSpec ? '✓' : '✗';

    console.log(`[${position}] ${statusIcon} ${product.name}`);

    if (hasSpec && spec) {
      console.log(`     Screen: ${spec.screen_size_inches || 'N/A'}" | Display: ${spec.display_type || 'N/A'}`);
      console.log(`     Chipset: ${spec.chipset || 'N/A'} | RAM: ${spec.ram_gb || 'N/A'}GB | Storage: ${spec.storage_gb || 'N/A'}GB`);
      console.log(`     Camera: ${spec.main_camera_mp || 'N/A'}MP main, ${spec.front_camera_mp || 'N/A'}MP front`);
      console.log(`     Battery: ${spec.battery_mah || 'N/A'}mAh | Charging: ${spec.charging_watt || 'N/A'}W`);
      console.log(`     5G: ${spec.is_5g ? 'Yes' : 'No'} | NFC: ${spec.has_nfc ? 'Yes' : 'No'} | IP: ${spec.ip_rating || 'N/A'}`);
    } else {
      console.log('     ⚠ NO SPECS FOUND');
    }
    console.log('');
  }

  // Summary
  const withSpecs = middleProducts.filter(async (p) => {
    const { data } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', p.id)
      .maybeSingle();
    return data !== null;
  }).length;

  console.log('\n=== SUMMARY ===');
  console.log(`Total middle section products: ${middleProducts.length}`);
  console.log(`Status: All products in positions 30-44 have been verified`);
}

verifyMiddleSection().catch(console.error);
