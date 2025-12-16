import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aivqthbxdshhltbwipbr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdnF0aGJ4ZHNoaGx0YndpcGJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjA1MTQ4MywiZXhwIjoyMDc3NjI3NDgzfQ.iw7-qPz0WKV0d7N_GcW67-2jEajp8LfZ2pZebSYmmoU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Checking Apple phone products...\n');

  // Get all Apple phones
  const { data: allProducts, error: allError } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%')
    .order('name', { ascending: true });

  if (allError) {
    console.error('Error:', allError);
    return;
  }

  console.log(`Total Apple phones: ${allProducts?.length || 0}\n`);

  // Get all product IDs that already have specs
  const { data: existingSpecs, error: specsError } = await supabase
    .from('product_key_specs')
    .select('product_id');

  if (specsError) {
    console.error('Error:', specsError);
    return;
  }

  const existingProductIds = new Set(existingSpecs?.map(s => s.product_id) || []);
  console.log(`Products with specs: ${existingProductIds.size}\n`);

  // Filter products without specs
  const productsWithoutSpecs = (allProducts || []).filter(p => !existingProductIds.has(p.id));

  console.log(`Products WITHOUT specs: ${productsWithoutSpecs.length}\n`);

  if (productsWithoutSpecs.length > 0) {
    console.log('All products without specs:');
    productsWithoutSpecs.forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.name} (ID: ${p.id})`);
    });
    console.log();

    // Show middle batch (30-44)
    const middleBatch = productsWithoutSpecs.slice(30, 45);
    console.log(`\nMiddle batch (OFFSET 30, LIMIT 15): ${middleBatch.length} products`);
    if (middleBatch.length > 0) {
      middleBatch.forEach((p, idx) => {
        console.log(`${idx + 31}. ${p.name} (ID: ${p.id})`);
      });
    }
  }
}

main().catch(console.error);
