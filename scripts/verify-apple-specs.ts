import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aivqthbxdshhltbwipbr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdnF0aGJ4ZHNoaGx0YndpcGJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjA1MTQ4MywiZXhwIjoyMDc3NjI3NDgzfQ.iw7-qPz0WKV0d7N_GcW67-2jEajp8LfZ2pZebSYmmoU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Apple Phone Specs Verification Report');
  console.log('='.repeat(80));
  console.log();

  // Get all Apple phone specs
  const { data: specs, error } = await supabase
    .from('product_key_specs')
    .select(`
      id,
      chipset,
      screen_size_inches,
      storage_gb,
      main_camera_mp,
      front_camera_mp,
      is_5g,
      has_wireless_charging,
      has_ois,
      battery_mah,
      ip_rating,
      refresh_rate_hz,
      products!inner(name, brand)
    `)
    .ilike('products.brand', '%apple%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total Apple phone specs in database: ${specs?.length || 0}\n`);

  // Group by model for summary
  const modelGroups: Record<string, number> = {};

  for (const spec of specs || []) {
    const name = (spec.products as any).name;

    console.log(`Product: ${name}`);
    console.log(`  Chipset: ${spec.chipset || 'N/A'}`);
    console.log(`  Screen: ${spec.screen_size_inches || 'N/A'}" @ ${spec.refresh_rate_hz || 60}Hz`);
    console.log(`  Storage: ${spec.storage_gb || 'N/A'}GB`);
    console.log(`  Camera: ${spec.main_camera_mp || 'N/A'}MP main, ${spec.front_camera_mp || 'N/A'}MP front`);
    console.log(`  Battery: ${spec.battery_mah || 'N/A'}mAh`);
    console.log(`  Features: 5G=${spec.is_5g ? 'Yes' : 'No'}, Wireless Charging=${spec.has_wireless_charging ? 'Yes' : 'No'}, OIS=${spec.has_ois ? 'Yes' : 'No'}`);
    console.log(`  IP Rating: ${spec.ip_rating || 'N/A'}`);
    console.log();

    // Extract model for grouping
    const modelMatch = name.match(/(iPhone [^0-9]*\d+[^(]*)/i);
    if (modelMatch) {
      const model = modelMatch[1].trim();
      modelGroups[model] = (modelGroups[model] || 0) + 1;
    }
  }

  console.log('='.repeat(80));
  console.log('SUMMARY BY MODEL');
  console.log('='.repeat(80));
  Object.entries(modelGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([model, count]) => {
      console.log(`${model}: ${count} variant(s)`);
    });

  console.log();
  console.log('='.repeat(80));
  console.log('COMPLETION STATUS');
  console.log('='.repeat(80));

  // Check for any Apple phones without specs
  const { data: allApplePhones } = await supabase
    .from('products')
    .select('id, name')
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%');

  const productsWithSpecs = new Set(specs?.map(s => (s.products as any).name));
  const productsWithoutSpecs = allApplePhones?.filter(p => !productsWithSpecs.has(p.name)) || [];

  console.log(`Apple phones with specs: ${specs?.length || 0}`);
  console.log(`Apple phones without specs: ${productsWithoutSpecs.length}`);

  if (productsWithoutSpecs.length > 0) {
    console.log('\nProducts still missing specs:');
    productsWithoutSpecs.forEach(p => console.log(`  - ${p.name}`));
  }
}

main().catch(console.error);
