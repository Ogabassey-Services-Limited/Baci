import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function addMissingCategories() {
  console.log('=== ADDING MISSING CATEGORIES ===\n');

  // 1. Get OgaBassey merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name')
    .ilike('business_name', '%ogabassey%')
    .single();

  if (!merchant) {
    console.log('OgaBassey merchant not found');
    return;
  }

  console.log(`Merchant: ${merchant.business_name}\n`);

  // 2. Get existing categories
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .eq('merchant_id', merchant.id);

  const existingSlugs = new Set(categories?.map(c => c.slug) || []);
  const wearablesParent = categories?.find(c => c.slug === 'wearables');

  console.log('Existing category slugs:', [...existingSlugs].sort().join(', '));

  // 3. Add Smartwatches under Wearables if missing
  if (!existingSlugs.has('smartwatches') && wearablesParent) {
    console.log('\nAdding Smartwatches category under Wearables...');
    const { error } = await supabase
      .from('categories')
      .insert({
        merchant_id: merchant.id,
        name: 'Smartwatches',
        slug: 'smartwatches',
        parent_id: wearablesParent.id,
        display_order: 1,
        is_active: true,
      });

    if (error) {
      console.log('Error adding Smartwatches:', error.message);
    } else {
      console.log('✓ Added Smartwatches');
    }
  }

  // 4. Show final structure
  const { data: updatedCats } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .eq('merchant_id', merchant.id)
    .order('display_order');

  console.log('\n=== UPDATED CATEGORY STRUCTURE ===');
  const roots = updatedCats?.filter(c => !c.parent_id) || [];
  for (const root of roots) {
    console.log(`📁 ${root.name} (${root.slug})`);
    const children = updatedCats?.filter(c => c.parent_id === root.id) || [];
    for (const child of children) {
      console.log(`   └── ${child.name} (${child.slug})`);
    }
  }
}

addMissingCategories();
