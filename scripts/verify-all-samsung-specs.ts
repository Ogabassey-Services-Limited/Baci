import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== Samsung Phone Spec Verification ===\n');

  // Get all Samsung phones
  const { data: allProducts, error: prodError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%phone%')
    .ilike('brand', '%samsung%')
    .order('name', { ascending: false });

  if (prodError) throw prodError;

  console.log(`Total Samsung phones: ${allProducts.length}\n`);

  const withSpecs: any[] = [];
  const withoutSpecs: any[] = [];

  for (const product of allProducts) {
    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (spec) {
      withSpecs.push({ ...product, spec });
    } else {
      withoutSpecs.push(product);
    }
  }

  console.log('=== Products WITH Specs ===');
  console.log(`Count: ${withSpecs.length}\n`);

  withSpecs.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Screen: ${p.spec.screen_size_inches}" ${p.spec.display_type}`);
    console.log(`   Chipset: ${p.spec.chipset}`);
    console.log(`   RAM: ${p.spec.ram_gb}GB | Storage: ${p.spec.storage_gb}GB`);
    console.log(`   Camera: ${p.spec.main_camera_mp}MP main, ${p.spec.front_camera_mp}MP front`);
    console.log(`   Battery: ${p.spec.battery_mah}mAh, ${p.spec.charging_watt}W charging`);
    console.log(`   5G: ${p.spec.is_5g ? 'Yes' : 'No'} | IP: ${p.spec.ip_rating}`);
    console.log('');
  });

  if (withoutSpecs.length > 0) {
    console.log('\n=== Products WITHOUT Specs ===');
    console.log(`Count: ${withoutSpecs.length}\n`);

    withoutSpecs.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (ID: ${p.id})`);
    });
  }

  console.log('\n=== Summary ===');
  console.log(`Total products: ${allProducts.length}`);
  console.log(`With specs: ${withSpecs.length}`);
  console.log(`Without specs: ${withoutSpecs.length}`);
  console.log(`Coverage: ${((withSpecs.length / allProducts.length) * 100).toFixed(1)}%`);
}

main().catch(console.error);
