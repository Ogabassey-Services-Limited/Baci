import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Mapping from product.category TEXT values to category slugs
const CATEGORY_MAPPING: Record<string, string> = {
  // Phones
  'Smartphones': 'smartphones',
  'Samsung': 'samsung',
  'Oppo': 'oppo-phones',

  // Laptops
  'Laptops': 'laptops',
  'Gaming Laptops': 'gaming-laptops',

  // Tablets
  'Tablets': 'tablets',

  // Gaming
  'Gaming': 'gaming',
  'PlayStation 5': 'playstation-5',
  'PlayStation 4': 'playstation-4',
  'Xbox': 'xbox',
  'Nintendo Switch': 'nintendo-switch',
  'VR Headsets': 'vr-headsets',
  'Gaming Accessories': 'gaming-accessories',
  'Gift Cards': 'gift-cards',
  'Portable Gaming': 'steam-deck', // Map to Steam Deck or gaming

  // TVs
  'Samsung TVs': 'samsung-tvs',
  'LG TVs': 'lg-tvs',

  // Audio
  'Audio': 'audio',
  'Soundbars': 'soundbars',
  'Earbuds': 'earbuds',
  'Headphones': 'headphones',

  // Wearables
  'Smartwatches': 'smartwatches',
  'Wearables': 'wearables',
  'Apple': 'apple', // Apple wearables

  // Other
  'Accessories': 'accessories',
  'Monitors': 'monitors',
  'Printers': 'printers',
};

async function migrate() {
  console.log('=== MIGRATING products.category TO category_id ===\n');

  // 0. First add the category_id column if it doesn't exist
  console.log('Adding category_id column to products table...');
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;`
  });

  if (alterError) {
    console.log('Note: Could not add column via RPC, trying direct approach...');
    // Try a different approach - just proceed and see if column exists
  }

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

  // 2. Get all categories for this merchant
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, slug')
    .eq('merchant_id', merchant.id);

  if (catError) {
    console.log('Error fetching categories:', catError.message);
    return;
  }

  if (!categories?.length) {
    console.log('No categories found for merchant:', merchant.id);
    return;
  }

  const slugToId = new Map(categories.map(c => [c.slug, c.id]));
  const nameToId = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

  console.log(`Loaded ${categories.length} categories\n`);

  // 3. Get all products with their current category TEXT (only those without category_id)
  const { data: products, count } = await supabase
    .from('products')
    .select('id, name, category', { count: 'exact' })
    .eq('merchant_id', merchant.id)
    .is('category_id', null)
    .limit(2000);

  console.log(`Total products without category_id: ${count}`);

  if (!products?.length) {
    console.log('No products found without category_id - all done!');
    return;
  }

  console.log(`Processing ${products.length} products...\n`);

  let mapped = 0;
  let unmapped = 0;
  const unmappedCategories = new Set<string>();

  // Group products by category for batch updates
  const categoryGroups = new Map<string, string[]>(); // categoryId -> productIds

  for (const product of products) {
    const catText = product.category;
    if (!catText) {
      unmapped++;
      unmappedCategories.add('NULL');
      continue;
    }

    // Try mapping
    let categoryId: string | undefined;

    // 1. Try direct mapping
    const mappedSlug = CATEGORY_MAPPING[catText];
    if (mappedSlug) {
      categoryId = slugToId.get(mappedSlug);
    }

    // 2. Try by name (case-insensitive)
    if (!categoryId) {
      categoryId = nameToId.get(catText.toLowerCase());
    }

    // 3. Try by slug (convert name to slug)
    if (!categoryId) {
      const asSlug = catText.toLowerCase().replace(/\s+/g, '-');
      categoryId = slugToId.get(asSlug);
    }

    if (categoryId) {
      if (!categoryGroups.has(categoryId)) {
        categoryGroups.set(categoryId, []);
      }
      categoryGroups.get(categoryId)!.push(product.id);
    } else {
      unmapped++;
      unmappedCategories.add(catText);
    }
  }

  // Batch update by category
  console.log(`Found ${categoryGroups.size} distinct categories to update\n`);

  for (const [categoryId, productIds] of categoryGroups) {
    const catName = categories.find(c => c.id === categoryId)?.name || 'Unknown';
    console.log(`Updating ${productIds.length} products to "${catName}"...`);

    const { error } = await supabase
      .from('products')
      .update({ category_id: categoryId })
      .in('id', productIds);

    if (error) {
      console.log(`  Error: ${error.message}`);
    } else {
      mapped += productIds.length;
      console.log(`  ✓ Updated ${productIds.length} products`);
    }
  }

  console.log('\n=== RESULTS ===');
  console.log(`Mapped: ${mapped}`);
  console.log(`Unmapped: ${unmapped}`);

  if (unmappedCategories.size > 0) {
    console.log('\nUnmapped category values:');
    for (const cat of unmappedCategories) {
      console.log(`  - "${cat}"`);
    }
  }

  // 4. Verify
  const { count: withId } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchant.id)
    .not('category_id', 'is', null);

  const { count: withoutId } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchant.id)
    .is('category_id', null);

  console.log('\n=== VERIFICATION ===');
  console.log(`Products with category_id: ${withId}`);
  console.log(`Products without category_id: ${withoutId}`);
}

migrate();
