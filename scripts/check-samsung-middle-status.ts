import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aivqthbxdshhltbwipbr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSamsungStatus() {
  console.log('=== Samsung Phone Spec Status Check ===\n');

  // Get all Samsung phones
  const { data: allProducts, error: allError } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%phone%')
    .ilike('brand', '%samsung%')
    .order('name', { ascending: true });

  if (allError) {
    console.error('Error fetching products:', allError);
    return;
  }

  console.log(`Total Samsung phones in database: ${allProducts?.length || 0}\n`);

  if (!allProducts || allProducts.length === 0) {
    console.log('No Samsung phones found');
    return;
  }

  // Check which ones have specs
  const withSpecs: string[] = [];
  const withoutSpecs: Array<{ id: string; name: string; position: number }> = [];

  for (let i = 0; i < allProducts.length; i++) {
    const product = allProducts[i];
    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .maybeSingle();

    if (spec) {
      withSpecs.push(product.name);
    } else {
      withoutSpecs.push({
        id: product.id,
        name: product.name,
        position: i
      });
    }
  }

  console.log(`Products WITH specs: ${withSpecs.length}`);
  console.log(`Products WITHOUT specs: ${withoutSpecs.length}\n`);

  if (withoutSpecs.length > 0) {
    console.log('=== Products WITHOUT specs ===');
    withoutSpecs.forEach((p, idx) => {
      const section = p.position < 30 ? 'FIRST' : p.position < 45 ? 'MIDDLE' : 'LAST';
      console.log(`${idx + 1}. [Position ${p.position}] [${section}] ${p.name}`);
      console.log(`   ID: ${p.id}`);
    });

    // Count by section
    const first = withoutSpecs.filter(p => p.position < 30).length;
    const middle = withoutSpecs.filter(p => p.position >= 30 && p.position < 45).length;
    const last = withoutSpecs.filter(p => p.position >= 45).length;

    console.log(`\n=== By Section ===`);
    console.log(`FIRST (0-29): ${first} products`);
    console.log(`MIDDLE (30-44): ${middle} products`);
    console.log(`LAST (45+): ${last} products`);

    if (middle > 0) {
      console.log(`\n=== MIDDLE SECTION Products (30-44) ===`);
      const middleProducts = withoutSpecs.filter(p => p.position >= 30 && p.position < 45);
      middleProducts.forEach((p, idx) => {
        console.log(`${idx + 1}. [${p.position}] ${p.name}`);
        console.log(`   ID: ${p.id}`);
      });
    }
  } else {
    console.log('✓ All Samsung phones have specs populated!');
  }
}

checkSamsungStatus().catch(console.error);
