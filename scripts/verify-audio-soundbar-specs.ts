import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProductWithSpecs {
  id: string;
  name: string;
  brand: string;
  category: string;
  specs: any;
}

async function verifyAudioSoundbarSpecs() {
  console.log('🔍 Verifying Audio & Soundbar Specs Coverage\n');
  console.log('='.repeat(70));

  // Get all audio products with their specs
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      brand,
      category
    `)
    .or('category.ilike.%audio%,category.ilike.%earbuds%,category.ilike.%headphones%,category.ilike.%soundbar%')
    .order('name');

  if (error || !products) {
    console.error('❌ Error fetching products:', error);
    return;
  }

  console.log(`📦 Total Audio Products: ${products.length}\n`);

  // Fetch specs for each product
  const productsWithSpecs: ProductWithSpecs[] = [];
  const productsWithoutSpecs: ProductWithSpecs[] = [];

  for (const product of products) {
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (specs) {
      productsWithSpecs.push({ ...product, specs });
    } else {
      productsWithoutSpecs.push({ ...product, specs: null });
    }
  }

  // Category breakdown
  const categoryStats: Record<string, { total: number; withSpecs: number }> = {};

  for (const product of products) {
    const categoryName = getCategoryName(product.category || 'Unknown');
    if (!categoryStats[categoryName]) {
      categoryStats[categoryName] = { total: 0, withSpecs: 0 };
    }
    categoryStats[categoryName].total++;
  }

  for (const product of productsWithSpecs) {
    const categoryName = getCategoryName(product.category || 'Unknown');
    if (categoryStats[categoryName]) {
      categoryStats[categoryName].withSpecs++;
    }
  }

  // Display category breakdown
  console.log('📊 SPECS COVERAGE BY CATEGORY');
  console.log('='.repeat(70));
  for (const [category, stats] of Object.entries(categoryStats)) {
    const percentage = ((stats.withSpecs / stats.total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(stats.withSpecs / stats.total * 20));
    console.log(`\n${category}:`);
    console.log(`  Total: ${stats.total} | With Specs: ${stats.withSpecs} | Coverage: ${percentage}%`);
    console.log(`  [${bar}]`);
  }

  // Overall stats
  const totalWithSpecs = productsWithSpecs.length;
  const totalWithoutSpecs = productsWithoutSpecs.length;
  const coveragePercent = ((totalWithSpecs / products.length) * 100).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('📈 OVERALL COVERAGE');
  console.log('='.repeat(70));
  console.log(`✅ Products with specs: ${totalWithSpecs}`);
  console.log(`❌ Products without specs: ${totalWithoutSpecs}`);
  console.log(`📊 Coverage: ${coveragePercent}%`);

  // Products without specs
  if (productsWithoutSpecs.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  PRODUCTS WITHOUT SPECS');
    console.log('='.repeat(70));
    productsWithoutSpecs.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name} (${p.brand || 'Unknown'})`);
    });
  }

  // Sample specs data for verification
  console.log('\n' + '='.repeat(70));
  console.log('📋 SAMPLE SPECS DATA (First 10 products)');
  console.log('='.repeat(70));

  const sampleProducts = productsWithSpecs.slice(0, 10);
  for (const product of sampleProducts) {
    console.log(`\n${product.name}:`);
    console.log(`  Bluetooth: ${product.specs.bluetooth_version || 'N/A'}`);
    console.log(`  Weight: ${product.specs.weight_g ? product.specs.weight_g + 'g' : 'N/A'}`);
    console.log(`  Dimensions: ${product.specs.dimensions_mm || 'N/A'}`);
    console.log(`  Battery: ${product.specs.battery_mah ? product.specs.battery_mah + 'mAh' : 'N/A'}`);
    console.log(`  IP Rating: ${product.specs.ip_rating || 'N/A'}`);
    console.log(`  NFC: ${product.specs.has_nfc ? 'Yes' : 'No'}`);
    const colors = Array.isArray(product.specs.available_colors)
      ? product.specs.available_colors.join(', ')
      : product.specs.available_colors || 'N/A';
    console.log(`  Colors: ${colors}`);

    // Soundbar-specific fields
    if (product.category?.toLowerCase().includes('soundbar')) {
      console.log(`  Channel Config: ${product.specs.storage_gb ? product.specs.storage_gb + '.x' : 'N/A'}`);
      console.log(`  Power Output: ${product.specs.charging_watt ? product.specs.charging_watt + 'W' : 'N/A'}`);
    }
  }

  // Soundbar-specific report
  const soundbars = productsWithSpecs.filter(p => p.category?.toLowerCase().includes('soundbar'));
  if (soundbars.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('🔊 SOUNDBAR SPECS SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Soundbars with Specs: ${soundbars.length}\n`);

    soundbars.forEach(sb => {
      console.log(`${sb.name}:`);
      console.log(`  Channel: ${sb.specs.storage_gb ? sb.specs.storage_gb + '.x' : 'N/A'} | Power: ${sb.specs.charging_watt ? sb.specs.charging_watt + 'W' : 'N/A'}`);
      console.log(`  Bluetooth: ${sb.specs.bluetooth_version || 'N/A'} | Weight: ${sb.specs.weight_g ? sb.specs.weight_g + 'g' : 'N/A'}`);
      console.log('');
    });
  }

  console.log('='.repeat(70));
  console.log('✅ Verification Complete!\n');
}

function getCategoryName(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('soundbar')) return 'Soundbars';
  if (cat.includes('earbuds')) return 'Earbuds';
  if (cat.includes('headphone')) return 'Headphones';
  if (cat.includes('speaker')) return 'Speakers';
  return 'Other Audio';
}

verifyAudioSoundbarSpecs().catch(console.error);
