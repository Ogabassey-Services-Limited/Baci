import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aivqthbxdshhltbwipbr.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdnF0aGJ4ZHNoaGx0YndpcGJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjA1MTQ4MywiZXhwIjoyMDc3NjI3NDgzfQ.iw7-qPz0WKV0d7N_GcW67-2jEajp8LfZ2pZebSYmmoU';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function verify() {
  console.log('🔍 Verifying Dell Laptop Spec Completion...\n');

  // Query for any Dell laptops without specs
  const { data: existingSpecs, error: specsError } = await supabase
    .from('product_key_specs')
    .select('product_id');

  if (specsError) throw specsError;

  const existingProductIds = new Set(existingSpecs?.map(s => s.product_id) || []);

  const { data: allDellLaptops, error } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%laptop%')
    .ilike('brand', '%dell%');

  if (error) throw error;

  const withoutSpecs = allDellLaptops?.filter(
    laptop => !existingProductIds.has(laptop.id)
  ) || [];

  if (withoutSpecs.length === 0) {
    console.log('✅ SUCCESS! All Dell laptops have specifications!');
    console.log(`   Total Dell laptops: ${allDellLaptops?.length || 0}`);
    console.log(`   All have specs: ${allDellLaptops?.length || 0}`);
    console.log('   Coverage: 100.0%\n');
  } else {
    console.log('❌ INCOMPLETE! Some Dell laptops are missing specs:');
    console.log(`   Total Dell laptops: ${allDellLaptops?.length || 0}`);
    console.log(`   Missing specs: ${withoutSpecs.length}\n`);
    console.log('Missing models:');
    withoutSpecs.forEach((laptop, i) => {
      console.log(`   ${i + 1}. ${laptop.name}`);
    });
  }
}

verify();
