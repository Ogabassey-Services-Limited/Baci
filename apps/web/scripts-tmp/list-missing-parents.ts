import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from the root .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listMissingParents() {
  console.log(
    'Fetching all gaming parent products to check for missing images...'
  );

  // Fetch all parent products (parent_product_id is null)
  const { data: parents, error } = await supabase
    .from('products')
    .select('id, name, images')
    .is('parent_product_id', null);

  if (error) {
    console.error('Error fetching parents:', error);
    return;
  }

  // Filter for missing or empty images
  const reallyMissing = parents?.filter(
    (p) => !p.images || (Array.isArray(p.images) && p.images.length === 0)
  );

  console.log(
    `Found ${reallyMissing?.length} parent products with missing images.`
  );

  if (reallyMissing && reallyMissing.length > 0) {
    reallyMissing.forEach((p) => {
      console.log(`- [${p.id}] "${p.name}"`);
    });
  }
}

listMissingParents();
