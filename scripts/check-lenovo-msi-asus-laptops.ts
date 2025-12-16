import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('🔍 Checking Lenovo/MSI/Asus laptop availability...\n');

  // Check total laptops
  const { data: allLaptops, error: e1 } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%laptop%');

  console.log('Total laptops in database:', allLaptops?.length || 0);

  // Check Lenovo/MSI/Asus
  const { data: targetLaptops, error: e2 } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .ilike('category', '%laptop%')
    .or('brand.ilike.%lenovo%,brand.ilike.%msi%,brand.ilike.%asus%');

  console.log('Lenovo/MSI/Asus laptops:', targetLaptops?.length || 0);

  if (targetLaptops && targetLaptops.length > 0) {
    console.log('\n📋 Sample laptops:');
    targetLaptops.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. ${p.brand} - ${p.name}`);
    });

    // Check how many have specs
    let withSpecs = 0;
    let withoutSpecs: typeof targetLaptops = [];

    for (const laptop of targetLaptops) {
      const { data: spec } = await supabase
        .from('product_key_specs')
        .select('id')
        .eq('product_id', laptop.id)
        .single();

      if (spec) {
        withSpecs++;
      } else {
        withoutSpecs.push(laptop);
      }
    }

    console.log(`\n📊 Spec Coverage:`);
    console.log(`   With specs: ${withSpecs}/${targetLaptops.length}`);
    console.log(`   Without specs: ${targetLaptops.length - withSpecs}/${targetLaptops.length}`);

    if (withoutSpecs.length > 0) {
      console.log(`\n⚠️  Laptops needing specs (showing first 20):`);
      withoutSpecs.slice(0, 20).forEach((p, i) => {
        console.log(`${i + 1}. ${p.brand} - ${p.name} (${p.id})`);
      });
    }
  } else {
    console.log('\n❌ No Lenovo/MSI/Asus laptops found in database.');
    console.log('   Checking brand distribution...');

    const { data: brands } = await supabase
      .from('products')
      .select('brand')
      .ilike('category', '%laptop%');

    if (brands) {
      const brandCounts = brands.reduce((acc: Record<string, number>, p) => {
        acc[p.brand] = (acc[p.brand] || 0) + 1;
        return acc;
      }, {});

      console.log('\n   Laptop brands in database:');
      Object.entries(brandCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .forEach(([brand, count]) => {
          console.log(`   - ${brand}: ${count}`);
        });
    }
  }
}

check();
