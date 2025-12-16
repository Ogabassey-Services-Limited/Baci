import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function check() {
  console.log('=== SPECS COVERAGE BY CATEGORY ===\n');

  // Get all products with their category and whether they have specs
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      category,
      product_key_specs (id)
    `);

  if (!products) return;

  // Group by category
  const categoryStats = new Map<string, { total: number; withSpecs: number }>();

  for (const p of products) {
    const cat = p.category || 'NULL';
    if (!categoryStats.has(cat)) {
      categoryStats.set(cat, { total: 0, withSpecs: 0 });
    }
    const stats = categoryStats.get(cat)!;
    stats.total++;
    if (p.product_key_specs) {
      stats.withSpecs++;
    }
  }

  // Sort by total and display
  const sorted = [...categoryStats.entries()].sort((a, b) => b[1].total - a[1].total);

  console.log('Category                     | Total | With Specs | Coverage');
  console.log('-'.repeat(65));

  for (const [cat, stats] of sorted) {
    const coverage = ((stats.withSpecs / stats.total) * 100).toFixed(0);
    const catName = cat.substring(0, 28).padEnd(28);
    console.log(`${catName} | ${String(stats.total).padStart(5)} | ${String(stats.withSpecs).padStart(10)} | ${coverage}%`);
  }
}

check();
