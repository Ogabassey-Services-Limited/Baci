import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
}

interface ProductKeySpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  display_resolution?: string;
  battery_mah?: number;
  has_nfc?: boolean;
  ip_rating?: string;
  has_gps?: boolean;
  bluetooth_version?: string;
  weight_g?: number;
  dimensions_mm?: string;
  chipset?: string;
  storage_gb?: number;
  sensors?: string[];
  available_colors?: string[];
  release_date?: string;
}

async function getSmartwatchesWithoutSpecs(): Promise<Product[]> {
  // Query for smartwatches and wearables
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('category.ilike.%smartwatch%,category.ilike.%wearable%,category.ilike.%watch%,name.ilike.%watch%')
    .order('name')
    .limit(50);

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  // Filter out products that already have specs
  const productsWithoutSpecs: Product[] = [];

  for (const product of data || []) {
    const { data: specs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .single();

    if (!specs) {
      productsWithoutSpecs.push(product);
    }
  }

  // Return first 20 alphabetically
  return productsWithoutSpecs.slice(0, 20);
}

async function insertSpecs(productId: string, specs: Partial<ProductKeySpecs>): Promise<boolean> {
  const specsToInsert: ProductKeySpecs = {
    product_id: productId,
    ...specs,
  };

  const { error } = await supabase
    .from('product_key_specs')
    .upsert(specsToInsert, {
      onConflict: 'product_id',
    });

  if (error) {
    console.error(`Error inserting specs for product ${productId}:`, error);
    return false;
  }

  return true;
}

async function batchInsertSpecs(specsArray: ProductKeySpecs[]): Promise<boolean> {
  if (specsArray.length === 0) return true;

  const { error } = await supabase
    .from('product_key_specs')
    .upsert(specsArray, {
      onConflict: 'product_id',
    });

  if (error) {
    console.error('Error batch inserting specs:', error);
    return false;
  }

  return true;
}

async function main() {
  console.log('Starting Smartwatch spec population...\n');

  try {
    const products = await getSmartwatchesWithoutSpecs();
    console.log(`Found ${products.length} smartwatches without specs (first 20 alphabetically)\n`);

    if (products.length === 0) {
      console.log('All smartwatches already have specs populated!');
      return;
    }

    console.log('Products to process:');
    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (${p.brand}) [${p.category}] - ${p.id}`);
    });

    console.log('\n--- Ready for spec population ---');
    console.log('I will now research and populate specs for these smartwatches.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

export { getSmartwatchesWithoutSpecs, insertSpecs, batchInsertSpecs };

// Run main function
main().catch(console.error);
