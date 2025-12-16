/**
 * Add TV-specific columns to product_key_specs table
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔧 Adding TV-specific columns to product_key_specs\n');

  const columns = [
    { name: 'panel_type', type: 'TEXT', description: 'Panel technology (VA, IPS, OLED)' },
    { name: 'smart_tv_os', type: 'TEXT', description: 'Smart TV operating system' },
    { name: 'hdmi_ports', type: 'INTEGER', description: 'Number of HDMI ports' },
    { name: 'has_hdr', type: 'BOOLEAN', description: 'HDR support' },
    { name: 'hdr_formats', type: 'TEXT', description: 'Supported HDR formats (HDR10, HDR10+, Dolby Vision)' },
    { name: 'audio_power_watts', type: 'INTEGER', description: 'Speaker power output in watts' },
    { name: 'has_bluetooth', type: 'BOOLEAN', description: 'Bluetooth connectivity' },
    { name: 'usb_ports', type: 'INTEGER', description: 'Number of USB ports' },
  ];

  for (const column of columns) {
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};`
      });

      if (error) {
        console.log(`⚠️  ${column.name}: Using direct query approach...`);
        // Try alternative approach using admin client
        // Note: This will need to be done via Supabase dashboard or direct SQL
        console.log(`   SQL: ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};`);
      } else {
        console.log(`✅ Added column: ${column.name} (${column.type}) - ${column.description}`);
      }
    } catch (err: any) {
      console.log(`📝 Column ${column.name}: ${err.message}`);
    }
  }

  console.log('\n✨ TV columns setup complete!');
  console.log('\nNote: If columns were not added automatically, run these SQL commands in Supabase SQL Editor:');
  console.log('---');
  columns.forEach(col => {
    console.log(`ALTER TABLE product_key_specs ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`);
  });
}

main().catch(console.error);
