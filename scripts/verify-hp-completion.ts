import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Verifying HP Laptop Specs Completion\n');

  // Count total HP laptops
  const { count: totalHPLaptops } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .ilike('category', '%laptop%')
    .ilike('brand', '%hp%');

  console.log(`📦 Total HP laptops in database: ${totalHPLaptops}`);

  // Count HP laptops with specs
  const { data: hpWithSpecs, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      brand,
      product_key_specs(
        screen_size_inches,
        display_type,
        chipset,
        ram_gb,
        storage_gb,
        battery_mah
      )
    `)
    .ilike('category', '%laptop%')
    .ilike('brand', '%hp%');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  const withSpecs = hpWithSpecs?.filter(p => p.product_key_specs && p.product_key_specs.length > 0) || [];
  const withoutSpecs = hpWithSpecs?.filter(p => !p.product_key_specs || p.product_key_specs.length === 0) || [];

  console.log(`✅ HP laptops WITH specs: ${withSpecs.length}`);
  console.log(`❌ HP laptops WITHOUT specs: ${withoutSpecs.length}\n`);

  if (withoutSpecs.length > 0) {
    console.log('❌ LAPTOPS MISSING SPECS:');
    console.log('='.repeat(80));
    withoutSpecs.forEach((laptop, i) => {
      console.log(`${i + 1}. ${laptop.name} (ID: ${laptop.id})`);
    });
    console.log('='.repeat(80) + '\n');
  }

  // Sample 10 laptops with specs
  if (withSpecs.length > 0) {
    console.log('📊 SAMPLE OF HP LAPTOPS WITH SPECS:');
    console.log('='.repeat(100));

    const sample = withSpecs.slice(0, 10);
    sample.forEach((laptop, i) => {
      const spec = laptop.product_key_specs[0];
      console.log(`\n${i + 1}. ${laptop.name}`);
      console.log(`   ID: ${laptop.id}`);
      console.log(`   Screen: ${spec.screen_size_inches}" ${spec.display_type}`);
      console.log(`   CPU: ${spec.chipset}`);
      console.log(`   RAM: ${spec.ram_gb}GB | Storage: ${spec.storage_gb}GB`);
      console.log(`   Battery: ${spec.battery_mah}mAh`);
    });
    console.log('\n' + '='.repeat(100));
  }

  // Summary
  console.log('\n📈 COMPLETION SUMMARY:');
  console.log('='.repeat(60));
  console.log(`Total HP Laptops: ${totalHPLaptops}`);
  console.log(`With Specs: ${withSpecs.length} (${((withSpecs.length / (totalHPLaptops || 1)) * 100).toFixed(1)}%)`);
  console.log(`Without Specs: ${withoutSpecs.length}`);
  console.log('='.repeat(60));

  if (withoutSpecs.length === 0) {
    console.log('\n🎉 SUCCESS! ALL HP LAPTOPS HAVE SPECS! 🎉');
  } else {
    console.log(`\n⚠️  ${withoutSpecs.length} laptops still need specs`);
  }
}

main().catch(console.error);
