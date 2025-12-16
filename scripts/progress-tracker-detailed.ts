import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  console.log('\n=== DETAILED SPEC POPULATION ANALYSIS ===\n');

  // Get all products and specs
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .neq('status', 'archived');

  const { data: allSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specProductIds = new Set(allSpecs?.map(s => s.product_id) || []);

  // Priority targets
  console.log('=== PRIORITY TARGETS (Missing Specs) ===\n');

  // Samsung phones (high priority)
  const samsungPhones = allProducts?.filter(p =>
    p.brand === 'Samsung' &&
    (p.category?.toLowerCase().includes('phone') || p.category?.toLowerCase().includes('smartphone')) &&
    !specProductIds.has(p.id)
  ) || [];

  console.log(`Samsung Phones Missing Specs: ${samsungPhones.length}/82`);
  if (samsungPhones.length > 0) {
    console.log('Sample missing:');
    samsungPhones.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name}`);
    });
  }

  // Apple products with specs
  const appleWithSpecs = allProducts?.filter(p =>
    p.brand === 'Apple' && specProductIds.has(p.id)
  ) || [];
  console.log(`\nApple Products WITH Specs: ${appleWithSpecs.length}`);
  appleWithSpecs.forEach(p => {
    console.log(`  ✓ ${p.name} (${p.category})`);
  });

  // Infinix products with specs
  const infinixWithSpecs = allProducts?.filter(p =>
    p.brand === 'Infinix' && specProductIds.has(p.id)
  ) || [];
  console.log(`\nInfinix Products WITH Specs: ${infinixWithSpecs.length}`);
  infinixWithSpecs.forEach(p => {
    console.log(`  ✓ ${p.name}`);
  });

  // Google phones missing
  const googlePhones = allProducts?.filter(p =>
    p.brand === 'Google' &&
    (p.category?.toLowerCase().includes('phone') || p.category?.toLowerCase().includes('smartphone')) &&
    !specProductIds.has(p.id)
  ) || [];

  console.log(`\nGoogle Phones Missing Specs: ${googlePhones.length}/30`);
  if (googlePhones.length > 0) {
    console.log('Sample missing:');
    googlePhones.slice(0, 5).forEach(p => {
      console.log(`  - ${p.name}`);
    });
  }

  // Laptops missing
  const laptopsMissing = allProducts?.filter(p =>
    (p.category?.toLowerCase().includes('laptop') || p.category?.toLowerCase().includes('notebook')) &&
    !specProductIds.has(p.id)
  ) || [];

  console.log(`\nLaptops Missing Specs: ${laptopsMissing.length}/270`);

  // Group by brand
  const laptopsByBrand: Record<string, number> = {};
  laptopsMissing.forEach(p => {
    const brand = p.brand || 'Unknown';
    laptopsByBrand[brand] = (laptopsByBrand[brand] || 0) + 1;
  });

  console.log('Laptops missing by brand:');
  Object.entries(laptopsByBrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([brand, count]) => {
      console.log(`  - ${brand}: ${count}`);
    });

  // Summary stats
  console.log('\n=== SUMMARY ===');
  console.log(`Total Products: ${allProducts?.length || 0}`);
  console.log(`Products with Specs: ${allSpecs?.length || 0}`);
  console.log(`Products Missing Specs: ${(allProducts?.length || 0) - (allSpecs?.length || 0)}`);
  console.log(`Coverage: ${(((allSpecs?.length || 0) / (allProducts?.length || 1)) * 100).toFixed(1)}%`);

  const remaining = (allProducts?.length || 0) - (allSpecs?.length || 0);
  console.log(`\nRemaining to populate: ${remaining} products`);
  console.log('At 100 products/day: ~' + Math.ceil(remaining / 100) + ' days');
  console.log('At 500 products/day: ~' + Math.ceil(remaining / 500) + ' days');

  console.log('\n=== END DETAILED REPORT ===\n');
}

main().catch(console.error);
