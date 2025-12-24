import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function syncGamingVariants() {
  console.log('🚀 Starting Gaming Variant Sync (JS Filter Logic)...');

  // 1. Fetch all Gaming Parents that HAVE images
  const { data: parents, error: parentError } = await supabase
    .from('products')
    .select('id, name, images')
    .eq('is_parent', true)
    .not('images', 'is', null)
    .or(
      'category.ilike.%Gaming%,category.ilike.%Game%,category.ilike.%PlayStation%,category.ilike.%Xbox%,category.ilike.%Nintendo%'
    );

  if (parentError) {
    console.error('❌ Error fetching parents:', parentError);
    return;
  }

  console.log(`Found ${parents.length} Gaming Parents with images.`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const parent of parents) {
    if (!parent.images || parent.images.length === 0) continue;

    // 2. Fetch ALL variants for this parent
    const { data: variants, error: fetchError } = await supabase
      .from('products')
      .select('id, name, images')
      .eq('parent_product_id', parent.id) // Correct column
      .eq('is_parent', false);

    if (fetchError) {
      console.error(
        `   ❌ Failed to fetch variants for parent ${parent.name}:`,
        fetchError.message
      );
      continue;
    }

    if (!variants || variants.length === 0) continue;

    // 3. Filter in JS: only those with NO images
    const emptyVariants = variants.filter(
      (v) =>
        v.images === null || !Array.isArray(v.images) || v.images.length === 0
    );

    if (emptyVariants.length === 0) continue;

    // 4. Update them individually (or in batch if helpful, but individual is safer for tracking)
    // We can do a single update for all these IDs
    const variantIds = emptyVariants.map((v) => v.id);

    const { error: updateError } = await supabase
      .from('products')
      .update({ images: parent.images })
      .in('id', variantIds);

    if (updateError) {
      console.error(
        `   ❌ Failed to update variants for ${parent.name}:`,
        updateError.message
      );
      errorCount++;
    } else {
      // console.log(`   ✅ Synced ${variantIds.length} variants for "${parent.name}"`);
      updatedCount += variantIds.length;
    }
  }

  console.log('\n🎉 Sync Complete!');
  console.log(`   - Parents Processed: ${parents.length}`);
  console.log(`   - Variants Updated: ${updatedCount}`);
  console.log(`   - Errors count: ${errorCount}`);
}

syncGamingVariants();
