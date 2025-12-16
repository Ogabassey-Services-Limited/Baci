/**
 * Final TV specs report with detailed breakdown
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('📊 TV SPECS FINAL REPORT');
  console.log('='.repeat(70));
  console.log('');

  // Get all TV products with specs
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      name,
      brand,
      category
    `)
    .ilike('category', '%tv%')
    .order('brand', { ascending: true });

  if (!products || products.length === 0) {
    console.log('No TV products found');
    return;
  }

  // Fetch specs for all TVs
  const tvSpecs = [];
  for (const product of products) {
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (specs) {
      tvSpecs.push({
        ...product,
        specs
      });
    }
  }

  // Statistics
  const samsungTVs = tvSpecs.filter(tv => tv.brand.toLowerCase() === 'samsung');
  const lgTVs = tvSpecs.filter(tv => tv.brand.toLowerCase() === 'lg');

  console.log('📺 OVERVIEW');
  console.log('-'.repeat(70));
  console.log(`Total TV Products: ${products.length}`);
  console.log(`TVs with Specs: ${tvSpecs.length}`);
  console.log(`Coverage: ${((tvSpecs.length / products.length) * 100).toFixed(1)}%`);
  console.log('');
  console.log(`Samsung TVs: ${samsungTVs.length}`);
  console.log(`LG TVs: ${lgTVs.length}`);
  console.log('');

  // Screen sizes
  const screenSizes: { [key: number]: number } = {};
  tvSpecs.forEach(tv => {
    const size = tv.specs.screen_size_inches;
    screenSizes[size] = (screenSizes[size] || 0) + 1;
  });

  console.log('📏 SCREEN SIZES');
  console.log('-'.repeat(70));
  Object.entries(screenSizes)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([size, count]) => {
      console.log(`${size}": ${count} TVs`);
    });
  console.log('');

  // Display types by brand
  console.log('🎨 DISPLAY TYPES BY BRAND');
  console.log('-'.repeat(70));

  const samsungTypes: { [key: string]: number } = {};
  samsungTVs.forEach(tv => {
    const type = tv.specs.display_type;
    samsungTypes[type] = (samsungTypes[type] || 0) + 1;
  });

  console.log('Samsung:');
  Object.entries(samsungTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  const lgTypes: { [key: string]: number } = {};
  lgTVs.forEach(tv => {
    const type = tv.specs.display_type;
    lgTypes[type] = (lgTypes[type] || 0) + 1;
  });

  console.log('\nLG:');
  Object.entries(lgTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  console.log('');

  // Refresh rates
  const refreshRates: { [key: number]: number } = {};
  tvSpecs.forEach(tv => {
    const rate = tv.specs.refresh_rate_hz;
    refreshRates[rate] = (refreshRates[rate] || 0) + 1;
  });

  console.log('⚡ REFRESH RATES');
  console.log('-'.repeat(70));
  Object.entries(refreshRates)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .forEach(([rate, count]) => {
      console.log(`${rate}Hz: ${count} TVs`);
    });
  console.log('');

  // Premium TVs (OLED, Neo QLED, QLED)
  const premiumTVs = tvSpecs.filter(tv =>
    ['OLED', 'Neo QLED', 'QLED', 'QNED'].includes(tv.specs.display_type)
  );

  console.log('💎 PREMIUM TVS (OLED, Neo QLED, QLED, QNED)');
  console.log('-'.repeat(70));
  console.log(`Total Premium TVs: ${premiumTVs.length}`);
  premiumTVs
    .sort((a, b) => b.specs.screen_size_inches - a.specs.screen_size_inches)
    .forEach(tv => {
      console.log(`  ${tv.specs.screen_size_inches}" ${tv.brand} ${tv.specs.display_type} - ${tv.specs.refresh_rate_hz}Hz`);
    });
  console.log('');

  // 8K TVs
  const eightKTVs = tvSpecs.filter(tv => tv.specs.display_resolution === '8K UHD');
  console.log('🎬 8K TVS');
  console.log('-'.repeat(70));
  if (eightKTVs.length > 0) {
    eightKTVs.forEach(tv => {
      console.log(`  ${tv.brand} - ${tv.name}`);
      console.log(`    ${tv.specs.screen_size_inches}" ${tv.specs.display_type} @ ${tv.specs.refresh_rate_hz}Hz`);
    });
  } else {
    console.log('  No 8K TVs found');
  }
  console.log('');

  // Sample products
  console.log('📋 SAMPLE PRODUCTS');
  console.log('-'.repeat(70));

  const samples = [
    samsungTVs.find(tv => tv.specs.display_type === 'OLED'),
    samsungTVs.find(tv => tv.specs.display_type === 'Neo QLED'),
    lgTVs.find(tv => tv.specs.display_type === 'OLED'),
    lgTVs.find(tv => tv.specs.display_type === 'NanoCell'),
  ].filter(Boolean);

  samples.forEach(tv => {
    if (tv) {
      console.log(`\n${tv.brand} - ${tv.name}`);
      console.log(`  Screen: ${tv.specs.screen_size_inches}" ${tv.specs.display_type}`);
      console.log(`  Resolution: ${tv.specs.display_resolution}`);
      console.log(`  Refresh Rate: ${tv.specs.refresh_rate_hz}Hz`);
      console.log(`  Product ID: ${tv.id}`);
    }
  });

  console.log('');
  console.log('='.repeat(70));
  console.log('✅ TV specs population complete!');
  console.log('');
}

main().catch(console.error);
