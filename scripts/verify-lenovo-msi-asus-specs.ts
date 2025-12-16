import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  console.log('🔍 Verifying Lenovo/MSI/Asus Laptop Specs Coverage\n');
  console.log('═'.repeat(70));

  // Get all Lenovo/MSI/Asus laptops with their specs
  const { data: laptops, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      brand,
      category,
      product_key_specs (
        screen_size_inches,
        display_type,
        display_resolution,
        refresh_rate_hz,
        chipset,
        gpu,
        ram_gb,
        storage_gb,
        battery_mah,
        weight_g
      )
    `)
    .ilike('category', '%laptop%')
    .or('brand.ilike.%lenovo%,brand.ilike.%msi%,brand.ilike.%asus%')
    .order('brand', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Total Lenovo/MSI/Asus Laptops: ${laptops?.length || 0}\n`);

  // Group by brand
  const byBrand: Record<string, typeof laptops> = {};
  laptops?.forEach(laptop => {
    if (!byBrand[laptop.brand]) {
      byBrand[laptop.brand] = [];
    }
    byBrand[laptop.brand].push(laptop);
  });

  // Report by brand
  for (const [brand, brandLaptops] of Object.entries(byBrand)) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`${brand.toUpperCase()} LAPTOPS (${brandLaptops.length})`);
    console.log('─'.repeat(70));

    brandLaptops.forEach((laptop, i) => {
      const spec = laptop.product_key_specs?.[0];
      const hasSpecs = !!spec;

      console.log(`\n${i + 1}. ${laptop.name}`);
      console.log(`   ID: ${laptop.id}`);
      console.log(`   Specs: ${hasSpecs ? '✅' : '❌'}`);

      if (hasSpecs) {
        console.log(`   └─ Screen: ${spec.screen_size_inches || 'N/A'}" | ${spec.display_resolution || 'N/A'} | ${spec.refresh_rate_hz || 'N/A'}Hz`);
        console.log(`   └─ CPU: ${spec.chipset || 'N/A'}`);
        console.log(`   └─ GPU: ${spec.gpu || 'N/A'}`);
        console.log(`   └─ RAM: ${spec.ram_gb || 'N/A'}GB | Storage: ${spec.storage_gb || 'N/A'}GB`);
        console.log(`   └─ Battery: ${spec.battery_mah ? `${spec.battery_mah} mAh` : 'N/A'} | Weight: ${spec.weight_g ? `${spec.weight_g}g` : 'N/A'}`);
      }
    });
  }

  // Summary stats
  console.log('\n' + '═'.repeat(70));
  console.log('📈 SUMMARY STATISTICS');
  console.log('═'.repeat(70));

  const total = laptops?.length || 0;
  const withSpecs = laptops?.filter(l => l.product_key_specs?.length > 0).length || 0;
  const withoutSpecs = total - withSpecs;

  console.log(`\nTotal Products: ${total}`);
  console.log(`With Specs: ${withSpecs} (${total > 0 ? ((withSpecs / total) * 100).toFixed(1) : 0}%)`);
  console.log(`Without Specs: ${withoutSpecs} (${total > 0 ? ((withoutSpecs / total) * 100).toFixed(1) : 0}%)`);

  console.log('\nBreakdown by Brand:');
  for (const [brand, brandLaptops] of Object.entries(byBrand)) {
    const brandWithSpecs = brandLaptops.filter(l => l.product_key_specs?.length > 0).length;
    console.log(`  ${brand}: ${brandWithSpecs}/${brandLaptops.length} (${((brandWithSpecs / brandLaptops.length) * 100).toFixed(1)}%)`);
  }

  if (withSpecs === total) {
    console.log('\n✅ SUCCESS: All Lenovo/MSI/Asus laptops have specs populated!');
  } else {
    console.log(`\n⚠️  WARNING: ${withoutSpecs} laptop(s) still need specs.`);
  }

  console.log('\n' + '═'.repeat(70));
}

verify();
