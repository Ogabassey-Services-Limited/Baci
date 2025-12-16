import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  console.log('\n=== SPEC POPULATION PROGRESS ===\n');

  // 1. Overall coverage
  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'archived');

  const { count: specsCount } = await supabase
    .from('product_key_specs')
    .select('*', { count: 'exact', head: true });

  const overallPercentage = ((specsCount || 0) / (totalProducts || 1) * 100).toFixed(1);
  console.log(`Total: ${specsCount || 0}/${totalProducts || 0} products (${overallPercentage}%)\n`);

  // 2. Coverage by category
  console.log('By Category:');

  // Get all products with their categories
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, category')
    .neq('status', 'archived');

  const { data: allSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specProductIds = new Set(allSpecs?.map(s => s.product_id) || []);

  // Categorize products
  const categories = {
    phones: { total: 0, withSpecs: 0 },
    laptops: { total: 0, withSpecs: 0 },
    tablets: { total: 0, withSpecs: 0 },
    watches: { total: 0, withSpecs: 0 },
    tvs: { total: 0, withSpecs: 0 },
    audio: { total: 0, withSpecs: 0 },
    other: { total: 0, withSpecs: 0 }
  };

  allProducts?.forEach(p => {
    const cat = p.category?.toLowerCase() || '';
    const hasSpecs = specProductIds.has(p.id);

    if (cat.includes('phone') || cat.includes('smartphone')) {
      categories.phones.total++;
      if (hasSpecs) categories.phones.withSpecs++;
    } else if (cat.includes('laptop') || cat.includes('notebook')) {
      categories.laptops.total++;
      if (hasSpecs) categories.laptops.withSpecs++;
    } else if (cat.includes('tablet')) {
      categories.tablets.total++;
      if (hasSpecs) categories.tablets.withSpecs++;
    } else if (cat.includes('watch') || cat.includes('wearable')) {
      categories.watches.total++;
      if (hasSpecs) categories.watches.withSpecs++;
    } else if (cat.includes('tv') || cat.includes('television')) {
      categories.tvs.total++;
      if (hasSpecs) categories.tvs.withSpecs++;
    } else if (cat.includes('audio') || cat.includes('headphone') || cat.includes('earbuds')) {
      categories.audio.total++;
      if (hasSpecs) categories.audio.withSpecs++;
    } else {
      categories.other.total++;
      if (hasSpecs) categories.other.withSpecs++;
    }
  });

  for (const [name, data] of Object.entries(categories)) {
    if (data.total > 0) {
      const percentage = ((data.withSpecs / data.total) * 100).toFixed(1);
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      console.log(`- ${label}: ${data.withSpecs}/${data.total} (${percentage}%)`);
    }
  }

  // 3. Coverage by brand (phones only)
  console.log('\nBy Brand (Phones):');

  const { data: phoneProducts } = await supabase
    .from('products')
    .select('id, brand')
    .or('category.ilike.%phone%,category.ilike.%smartphone%')
    .neq('status', 'archived');

  const brandStats: Record<string, { total: number; withSpecs: number }> = {};

  phoneProducts?.forEach(p => {
    const brand = p.brand || 'Unknown';
    if (!brandStats[brand]) {
      brandStats[brand] = { total: 0, withSpecs: 0 };
    }
    brandStats[brand].total++;
    if (specProductIds.has(p.id)) {
      brandStats[brand].withSpecs++;
    }
  });

  // Sort by total count
  const sortedBrands = Object.entries(brandStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10); // Top 10 brands

  sortedBrands.forEach(([brand, data]) => {
    const percentage = ((data.withSpecs / data.total) * 100).toFixed(1);
    console.log(`- ${brand}: ${data.withSpecs}/${data.total} (${percentage}%)`);
  });

  // 4. Recent activity
  console.log('\n=== RECENT ACTIVITY ===');

  const { data: recentSpecs } = await supabase
    .from('product_key_specs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentSpecs && recentSpecs.length > 0) {
    const latestDate = new Date(recentSpecs[0].created_at);
    const oldestOfRecent = new Date(recentSpecs[recentSpecs.length - 1].created_at);
    console.log(`Last spec added: ${latestDate.toLocaleString()}`);
    console.log(`Last 10 specs added between: ${oldestOfRecent.toLocaleString()} - ${latestDate.toLocaleString()}`);
  }

  console.log('\n=== END REPORT ===\n');
}

main().catch(console.error);
