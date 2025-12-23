import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listRemainingParents() {
  console.log('Fetching gaming parents with missing images...');

  // Fetch all gaming parent products
  const { data: parents, error } = await supabase
    .from('products')
    .select('id, name, images')
    .eq('is_parent', true)
    .or(
      'category.ilike.%Gaming%,category.ilike.%Game%,category.ilike.%PlayStation%,category.ilike.%Xbox%,category.ilike.%Nintendo%'
    );

  if (error) {
    console.error('Error fetching parents:', error);
    return;
  }

  // Filter for those with empty or null images (doing this in JS to avoid JSONB filtering issues)
  const missingImages = parents.filter(
    (p) => !p.images || p.images.length === 0
  );

  console.log(`Found ${missingImages.length} parent products missing images.`);

  missingImages.forEach((p, index) => {
    console.log(`${index + 1}. [${p.id}] ${p.name}`);
  });
}

listRemainingParents();
