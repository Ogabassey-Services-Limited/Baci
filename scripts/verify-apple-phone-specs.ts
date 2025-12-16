import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyApplePhoneSpecs() {
  console.log('=== Apple Phone Specs Verification ===\n');

  // Get total count of Apple phones
  const { count: totalCount, error: totalError } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%');

  if (totalError) {
    console.error('Error fetching total count:', totalError);
    return;
  }

  console.log(`Total Apple phones in database: ${totalCount}\n`);

  // Get count of Apple phones WITH specs
  const { data: phonesWithSpecs, error: specsError } = await supabase
    .from('products')
    .select(`
      id,
      name,
      brand,
      product_key_specs (
        product_id,
        chipset,
        ram_gb,
        storage_gb,
        screen_size_inches,
        battery_mah
      )
    `)
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%');

  if (specsError) {
    console.error('Error fetching products with specs:', specsError);
    return;
  }

  const withSpecs = phonesWithSpecs?.filter(p => p.product_key_specs && p.product_key_specs.length > 0) || [];
  const withoutSpecs = phonesWithSpecs?.filter(p => !p.product_key_specs || p.product_key_specs.length === 0) || [];

  console.log(`Apple phones WITH specs: ${withSpecs.length}`);
  console.log(`Apple phones WITHOUT specs: ${withoutSpecs.length}\n`);

  // Calculate coverage percentage
  const coverage = totalCount ? ((withSpecs.length / totalCount) * 100).toFixed(1) : '0.0';
  console.log(`Spec coverage: ${coverage}%\n`);

  // Show products without specs
  if (withoutSpecs.length > 0) {
    console.log('Products WITHOUT specs:');
    console.log('─'.repeat(60));
    withoutSpecs.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
    });
    console.log('');
  }

  // Show sample of products WITH specs
  if (withSpecs.length > 0) {
    console.log('Sample products WITH specs (first 10):');
    console.log('─'.repeat(60));
    withSpecs.slice(0, 10).forEach((p, i) => {
      const specs = p.product_key_specs?.[0];
      if (specs) {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   Chipset: ${specs.chipset || 'N/A'}`);
        console.log(`   RAM: ${specs.ram_gb || 'N/A'}GB | Storage: ${specs.storage_gb || 'N/A'}GB`);
        console.log(`   Screen: ${specs.screen_size_inches || 'N/A'}" | Battery: ${specs.battery_mah || 'N/A'}mAh`);
        console.log('');
      }
    });
  }

  // Summary statistics
  console.log('=== SUMMARY ===');
  console.log(`Total Apple phones: ${totalCount}`);
  console.log(`With specs: ${withSpecs.length} (${coverage}%)`);
  console.log(`Without specs: ${withoutSpecs.length}`);
  console.log(`\nSpec population: ${withSpecs.length > 0 ? '✓ SUCCESS' : '✗ INCOMPLETE'}`);
}

verifyApplePhoneSpecs().catch(console.error);
