import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 Final HP Laptop Verification\n');

  // Get all HP laptop IDs
  const { data: hpLaptops } = await supabase
    .from('products')
    .select('id, name')
    .ilike('category', '%laptop%')
    .ilike('brand', '%hp%');

  console.log(`📦 Total HP laptops: ${hpLaptops?.length || 0}\n`);

  if (!hpLaptops || hpLaptops.length === 0) {
    console.log('❌ No HP laptops found');
    return;
  }

  // Check specs for each laptop
  const hpIds = hpLaptops.map(l => l.id);
  const { data: specs } = await supabase
    .from('product_key_specs')
    .select('product_id, chipset, ram_gb, storage_gb')
    .in('product_id', hpIds);

  const specsMap = new Map(specs?.map(s => [s.product_id, s]) || []);

  const withSpecs: any[] = [];
  const withoutSpecs: any[] = [];

  for (const laptop of hpLaptops) {
    if (specsMap.has(laptop.id)) {
      withSpecs.push({ ...laptop, spec: specsMap.get(laptop.id) });
    } else {
      withoutSpecs.push(laptop);
    }
  }

  console.log('📊 RESULTS:');
  console.log('='.repeat(80));
  console.log(`✅ HP laptops WITH specs: ${withSpecs.length}`);
  console.log(`❌ HP laptops WITHOUT specs: ${withoutSpecs.length}`);
  console.log(`📈 Completion rate: ${((withSpecs.length / hpLaptops.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  if (withoutSpecs.length > 0) {
    console.log('\n❌ MISSING SPECS:');
    withoutSpecs.forEach((laptop, i) => {
      console.log(`${i + 1}. ${laptop.name} (${laptop.id})`);
    });
  }

  if (withSpecs.length > 0) {
    console.log('\n✅ SAMPLE SPECS (first 10):');
    console.log('='.repeat(100));
    withSpecs.slice(0, 10).forEach((laptop, i) => {
      const spec = laptop.spec;
      console.log(`\n${i + 1}. ${laptop.name}`);
      console.log(`   CPU: ${spec.chipset} | RAM: ${spec.ram_gb}GB | Storage: ${spec.storage_gb}GB`);
    });
    console.log('\n' + '='.repeat(100));
  }

  if (withSpecs.length === hpLaptops.length) {
    console.log('\n🎉🎉🎉 SUCCESS! ALL HP LAPTOPS HAVE SPECS! 🎉🎉🎉');
  }
}

main().catch(console.error);
