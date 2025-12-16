import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAppleSpecs() {
  console.log('=== Direct Apple Phone Specs Check ===\n');

  // Get all Apple phones
  const { data: applePhones, error: phonesError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%')
    .order('name', { ascending: true });

  if (phonesError) {
    console.error('Error fetching phones:', phonesError);
    return;
  }

  console.log(`Total Apple phones: ${applePhones?.length || 0}\n`);

  // Get all specs
  const { data: allSpecs, error: specsError } = await supabase
    .from('product_key_specs')
    .select('product_id, chipset, ram_gb, storage_gb, screen_size_inches, battery_mah');

  if (specsError) {
    console.error('Error fetching specs:', specsError);
    return;
  }

  console.log(`Total specs in database: ${allSpecs?.length || 0}\n`);

  // Create a map of product IDs with specs
  const specMap = new Map(allSpecs?.map(s => [s.product_id, s]) || []);

  // Check which phones have specs
  const phonesWithSpecs: any[] = [];
  const phonesWithoutSpecs: any[] = [];

  applePhones?.forEach(phone => {
    if (specMap.has(phone.id)) {
      phonesWithSpecs.push({
        ...phone,
        specs: specMap.get(phone.id)
      });
    } else {
      phonesWithoutSpecs.push(phone);
    }
  });

  console.log(`Apple phones WITH specs: ${phonesWithSpecs.length}`);
  console.log(`Apple phones WITHOUT specs: ${phonesWithoutSpecs.length}\n`);

  const coverage = applePhones?.length ? ((phonesWithSpecs.length / applePhones.length) * 100).toFixed(1) : '0.0';
  console.log(`Spec coverage: ${coverage}%\n`);

  // Show products without specs
  if (phonesWithoutSpecs.length > 0) {
    console.log('Products WITHOUT specs:');
    console.log('─'.repeat(70));
    phonesWithoutSpecs.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (ID: ${p.id.substring(0, 8)}...)`);
    });
    console.log('');
  }

  // Show sample of products WITH specs
  if (phonesWithSpecs.length > 0) {
    console.log(`Sample products WITH specs (showing first 15 of ${phonesWithSpecs.length}):`);
    console.log('─'.repeat(70));
    phonesWithSpecs.slice(0, 15).forEach((p, i) => {
      const specs = p.specs;
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   Chipset: ${specs.chipset || 'N/A'} | RAM: ${specs.ram_gb || 'N/A'}GB`);
      console.log(`   Storage: ${specs.storage_gb || 'N/A'}GB | Screen: ${specs.screen_size_inches || 'N/A'}" | Battery: ${specs.battery_mah || 'N/A'}mAh`);
    });
    console.log('');
  }

  // Group by model
  const modelCounts = new Map<string, { total: number; withSpecs: number }>();
  applePhones?.forEach(phone => {
    // Extract model name (without storage/RAM variants)
    const modelMatch = phone.name.match(/iPhone [\w\s]+?(?=\d+GB|$)/i);
    const model = modelMatch ? modelMatch[0].trim() : phone.name;

    const current = modelCounts.get(model) || { total: 0, withSpecs: 0 };
    current.total++;
    if (specMap.has(phone.id)) {
      current.withSpecs++;
    }
    modelCounts.set(model, current);
  });

  console.log('Coverage by model:');
  console.log('─'.repeat(70));
  Array.from(modelCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([model, counts]) => {
      const pct = ((counts.withSpecs / counts.total) * 100).toFixed(0);
      console.log(`${model.padEnd(30)} ${counts.withSpecs}/${counts.total} (${pct}%)`);
    });
  console.log('');

  // Summary
  console.log('=== SUMMARY ===');
  console.log(`Total Apple phones: ${applePhones?.length || 0}`);
  console.log(`With specs: ${phonesWithSpecs.length} (${coverage}%)`);
  console.log(`Without specs: ${phonesWithoutSpecs.length}`);
  console.log(`\nStatus: ${phonesWithoutSpecs.length === 0 || phonesWithoutSpecs.every(p =>
    p.name.includes('Air') || p.name.includes('AirPods')
  ) ? '✓ SUCCESS - All valid iPhones have specs' : '✗ INCOMPLETE'}`);
}

checkAppleSpecs().catch(console.error);
