import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

function extractStorageFromName(name: string): number {
  const matches = name.match(/\d+GB|\d+TB/gi);

  if (!matches || matches.length < 2) {
    if (matches && matches.length === 1) {
      const match = matches[0].match(/(\d+)(GB|TB)/i);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toUpperCase();
        return unit === 'TB' ? value * 1024 : value;
      }
    }
    return 256;
  }

  const storageMatch = matches[1].match(/(\d+)(GB|TB)/i);
  if (!storageMatch) return 256;

  const value = parseInt(storageMatch[1]);
  const unit = storageMatch[2].toUpperCase();

  return unit === 'TB' ? value * 1024 : value;
}

async function main() {
  console.log('=== Fixing Z Fold Storage Values ===\n');

  // Get all Z Fold products with their specs
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name')
    .ilike('name', '%Galaxy Z Fold%');

  if (prodError) throw prodError;

  console.log(`Found ${products.length} Z Fold products\n`);

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const correctStorage = extractStorageFromName(product.name);

    // Get current spec
    const { data: spec } = await supabase
      .from('product_key_specs')
      .select('id, storage_gb')
      .eq('product_id', product.id)
      .single();

    if (!spec) {
      console.log(`${product.name}: No specs found, skipping`);
      skipped++;
      continue;
    }

    if (spec.storage_gb === correctStorage) {
      console.log(`${product.name}: Already correct (${correctStorage}GB)`);
      skipped++;
      continue;
    }

    // Update storage
    const { error: updateError } = await supabase
      .from('product_key_specs')
      .update({ storage_gb: correctStorage })
      .eq('id', spec.id);

    if (updateError) {
      console.error(`${product.name}: Error updating - ${updateError.message}`);
      continue;
    }

    console.log(`${product.name}: Updated ${spec.storage_gb}GB → ${correctStorage}GB`);
    updated++;
  }

  console.log('\n=== Summary ===');
  console.log(`Total: ${products.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch(console.error);
