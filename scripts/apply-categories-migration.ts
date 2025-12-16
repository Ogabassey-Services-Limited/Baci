import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function applyMigration() {
  console.log('=== APPLYING CATEGORIES HIERARCHY ===\n');

  // 1. Create categories table
  console.log('1. Creating categories table...');
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        seo_title TEXT,
        seo_description TEXT,
        image_url TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        product_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (createError) {
    // Table might already exist or we need to use direct SQL
    console.log('  Note: Using direct approach...');
  }

  // Check if categories table exists
  const { data: tableCheck } = await supabase
    .from('categories')
    .select('id')
    .limit(1);

  if (tableCheck === null) {
    console.log('  Categories table does not exist yet.');
    console.log('  Please run: npx supabase migration up --linked');
    console.log('  Or apply the migration manually via Supabase dashboard.');
    return;
  }

  console.log('  Categories table exists!');

  // 2. Insert parent categories
  console.log('\n2. Inserting parent categories...');
  const parentCategories = [
    { slug: 'phones', name: 'Phones', description: 'Smartphones from top brands including Samsung, Apple, Xiaomi, and more', display_order: 1 },
    { slug: 'laptops', name: 'Laptops', description: 'Laptops for work, gaming, and everyday use', display_order: 2 },
    { slug: 'tablets', name: 'Tablets', description: 'Tablets and iPads for productivity and entertainment', display_order: 3 },
    { slug: 'gaming', name: 'Gaming', description: 'Gaming consoles, accessories, and VR headsets', display_order: 4 },
    { slug: 'tvs', name: 'TVs', description: 'Smart TVs and displays', display_order: 5 },
    { slug: 'audio', name: 'Audio', description: 'Headphones, earbuds, soundbars, and speakers', display_order: 6 },
    { slug: 'wearables', name: 'Wearables', description: 'Smartwatches and fitness trackers', display_order: 7 },
    { slug: 'accessories', name: 'Accessories', description: 'Phone cases, chargers, cables, and more', display_order: 8 },
    { slug: 'printers', name: 'Printers', description: 'Printers and printing supplies', display_order: 9 },
  ];

  for (const cat of parentCategories) {
    const { error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' });
    if (error) console.log(`  Error inserting ${cat.name}:`, error.message);
    else console.log(`  ✓ ${cat.name}`);
  }

  // 3. Get parent IDs for child insertion
  const { data: parents } = await supabase
    .from('categories')
    .select('id, slug')
    .in('slug', ['gaming', 'tvs', 'audio', 'wearables']);

  const parentMap = new Map(parents?.map(p => [p.slug, p.id]) || []);

  // 4. Insert Gaming children
  console.log('\n3. Inserting Gaming subcategories...');
  const gamingChildren = [
    { slug: 'playstation-5', name: 'PlayStation 5', parent_id: parentMap.get('gaming'), description: 'PS5 consoles and bundles', display_order: 1 },
    { slug: 'playstation-4', name: 'PlayStation 4', parent_id: parentMap.get('gaming'), description: 'PS4 consoles and bundles', display_order: 2 },
    { slug: 'xbox', name: 'Xbox', parent_id: parentMap.get('gaming'), description: 'Xbox consoles and bundles', display_order: 3 },
    { slug: 'nintendo', name: 'Nintendo', parent_id: parentMap.get('gaming'), description: 'Nintendo Switch consoles and games', display_order: 4 },
    { slug: 'vr-headsets', name: 'VR Headsets', parent_id: parentMap.get('gaming'), description: 'Virtual reality headsets', display_order: 5 },
  ];

  for (const cat of gamingChildren) {
    const { error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' });
    if (error) console.log(`  Error: ${error.message}`);
    else console.log(`  ✓ ${cat.name}`);
  }

  // 5. Insert TV children
  console.log('\n4. Inserting TV subcategories...');
  const tvChildren = [
    { slug: 'samsung-tvs', name: 'Samsung TVs', parent_id: parentMap.get('tvs'), description: 'Samsung Smart TVs', display_order: 1 },
    { slug: 'lg-tvs', name: 'LG TVs', parent_id: parentMap.get('tvs'), description: 'LG Smart TVs', display_order: 2 },
  ];

  for (const cat of tvChildren) {
    const { error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' });
    if (error) console.log(`  Error: ${error.message}`);
    else console.log(`  ✓ ${cat.name}`);
  }

  // 6. Insert Audio children
  console.log('\n5. Inserting Audio subcategories...');
  const audioChildren = [
    { slug: 'headphones', name: 'Headphones', parent_id: parentMap.get('audio'), description: 'Over-ear and on-ear headphones', display_order: 1 },
    { slug: 'earbuds', name: 'Earbuds', parent_id: parentMap.get('audio'), description: 'Wireless earbuds', display_order: 2 },
    { slug: 'soundbars', name: 'Soundbars', parent_id: parentMap.get('audio'), description: 'Soundbars and home audio', display_order: 3 },
  ];

  for (const cat of audioChildren) {
    const { error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' });
    if (error) console.log(`  Error: ${error.message}`);
    else console.log(`  ✓ ${cat.name}`);
  }

  // 7. Insert Wearables children
  console.log('\n6. Inserting Wearables subcategories...');
  const wearablesChildren = [
    { slug: 'smartwatches', name: 'Smartwatches', parent_id: parentMap.get('wearables'), description: 'Smart watches', display_order: 1 },
    { slug: 'fitness-trackers', name: 'Fitness Trackers', parent_id: parentMap.get('wearables'), description: 'Fitness bands', display_order: 2 },
  ];

  for (const cat of wearablesChildren) {
    const { error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' });
    if (error) console.log(`  Error: ${error.message}`);
    else console.log(`  ✓ ${cat.name}`);
  }

  // 8. Show final structure
  console.log('\n=== CATEGORY HIERARCHY ===\n');
  const { data: allCats } = await supabase
    .from('categories')
    .select('id, slug, name, parent_id')
    .order('display_order');

  const roots = allCats?.filter(c => !c.parent_id) || [];
  for (const root of roots) {
    console.log(`📁 ${root.name}`);
    const children = allCats?.filter(c => c.parent_id === root.id) || [];
    for (const child of children) {
      console.log(`   └── ${child.name}`);
    }
  }

  console.log('\n=== DONE ===');
}

applyMigration();
