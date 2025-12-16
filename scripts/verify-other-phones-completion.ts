import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aivqthbxdshhltbwipbr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyCompletion() {
  console.log('=== Verification: Other Phones Spec Population ===\n');

  // Get all phones matching criteria
  const { data: allPhones, error: phonesError } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%phone%')
    .or('brand.ilike.%tecno%,brand.ilike.%vivo%,brand.ilike.%itel%,brand.ilike.%oppo%')
    .order('name', { ascending: false });

  if (phonesError) {
    console.error('Error fetching phones:', phonesError);
    return;
  }

  console.log(`Total phones found: ${allPhones?.length || 0}\n`);

  // Check which ones have specs
  let withSpecs = 0;
  let withoutSpecs = 0;
  const missingSpecs: Array<{ id: string; name: string; brand: string }> = [];

  for (const phone of allPhones || []) {
    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', phone.id)
      .maybeSingle();

    if (spec) {
      withSpecs++;
      console.log(`✓ ${phone.name} (${phone.brand})`);
    } else {
      withoutSpecs++;
      missingSpecs.push(phone);
      console.log(`✗ ${phone.name} (${phone.brand}) - MISSING SPECS`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total phones: ${allPhones?.length || 0}`);
  console.log(`With specs: ${withSpecs}`);
  console.log(`Without specs: ${withoutSpecs}`);

  if (missingSpecs.length > 0) {
    console.log('\n=== Missing Specs (First 15) ===');
    missingSpecs.slice(0, 15).forEach((phone, i) => {
      console.log(`${i + 1}. ${phone.name} (${phone.brand}) - ID: ${phone.id}`);
    });
  } else {
    console.log('\n✓ ALL PHONES HAVE SPECS - TASK COMPLETE!');
  }
}

verifyCompletion().catch(console.error);
