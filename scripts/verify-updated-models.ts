import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aivqthbxdshhltbwipbr.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdnF0aGJ4ZHNoaGx0YndpcGJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjA1MTQ4MywiZXhwIjoyMDc3NjI3NDgzfQ.iw7-qPz0WKV0d7N_GcW67-2jEajp8LfZ2pZebSYmmoU';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function verifyUpdated() {
  console.log('🔍 Verifying Models Updated in This Session\n');

  const modelNames = [
    'Dell Vostro 5490',
    'Dell Vostro 5481',
    'Dell Inspiron 7348'
  ];

  for (const modelName of modelNames) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .eq('name', modelName)
      .single();

    if (!products) {
      console.log(`❌ ${modelName} - Not found in products table`);
      continue;
    }

    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('*')
      .eq('product_id', products.id)
      .single();

    console.log(`✅ ${modelName}`);
    console.log('   ═══════════════════════════════════════');
    if (spec) {
      console.log(`   Screen: ${spec.screen_size_inches}"`);
      console.log(`   Display: ${spec.display_type} ${spec.display_resolution}`);
      console.log(`   Refresh: ${spec.refresh_rate_hz}Hz`);
      console.log(`   CPU: ${spec.chipset}`);
      console.log(`   GPU: ${spec.gpu}`);
      console.log(`   RAM: ${spec.ram_gb}GB`);
      console.log(`   Storage: ${spec.storage_gb}GB`);
      console.log(`   Battery: ${spec.battery_mah}mAh`);
      console.log(`   Weight: ${spec.weight_g}g`);
      console.log(`   Headphone Jack: ${spec.has_headphone_jack ? 'Yes' : 'No'}`);
      console.log(`   Fingerprint: ${spec.fingerprint_type || 'None'}`);
    } else {
      console.log('   ⚠️  No specs found!');
    }
    console.log('');
  }

  console.log('✅ Verification complete!\n');
}

verifyUpdated();
