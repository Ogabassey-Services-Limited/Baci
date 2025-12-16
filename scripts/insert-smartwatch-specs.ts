import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { smartwatchSpecs, type SmartwatchSpec } from './smartwatch-specs-data';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Product {
  id: string;
  name: string;
  brand: string;
}

interface ProductKeySpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  display_resolution?: string;
  battery_mah?: number;
  has_nfc?: boolean;
  ip_rating?: string;
  positioning?: string;
  bluetooth_version?: number;
  weight_g?: number;
  dimensions_mm?: string;
  chipset?: string;
  storage_gb?: number;
  sensors?: string;
  available_colors?: string;
  release_date?: string;
}

// Mapping of product names to spec keys
function getSpecKey(productName: string): string | null {
  const name = productName.toLowerCase();

  // Apple Watch SE 2022
  if (name.includes('se') && (name.includes('2022') || name.includes('2nd'))) {
    if (name.includes('40mm') || name.includes('40 mm')) {
      return 'apple-watch-se-2022-40mm';
    }
    if (name.includes('44mm') || name.includes('44 mm')) {
      return 'apple-watch-se-2022-44mm';
    }
  }

  // Apple Watch SE 2020
  if (name.includes('se') && (name.includes('2020') || name.includes('1st'))) {
    if (name.includes('40mm') || name.includes('40 mm')) {
      return 'apple-watch-se-2020-40mm';
    }
    if (name.includes('44mm') || name.includes('44 mm')) {
      return 'apple-watch-se-2020-44mm';
    }
  }

  // Apple Watch Series 10
  if (name.includes('series 10') || name.includes('series10')) {
    if (name.includes('42mm') || name.includes('42 mm')) {
      return 'apple-watch-series-10-42mm';
    }
    if (name.includes('46mm') || name.includes('46 mm')) {
      return 'apple-watch-series-10-46mm';
    }
  }

  // Apple Watch Series 3
  if (name.includes('series 3') || name.includes('series3')) {
    if (name.includes('38mm') || name.includes('38 mm')) {
      return 'apple-watch-series-3-38mm';
    }
    if (name.includes('42mm') || name.includes('42 mm')) {
      return 'apple-watch-series-3-42mm';
    }
  }

  // Apple Watch Series 4
  if (name.includes('series 4') || name.includes('series4')) {
    if (name.includes('40mm') || name.includes('40 mm')) {
      return 'apple-watch-series-4-40mm';
    }
    if (name.includes('44mm') || name.includes('44 mm')) {
      return 'apple-watch-series-4-44mm';
    }
  }

  // Apple Watch Series 11
  if (name.includes('series 11') || name.includes('series11')) {
    return 'apple-watch-series-11';
  }

  return null;
}

async function getSmartwatchesWithoutSpecs(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand')
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

  return productsWithoutSpecs.slice(0, 20);
}

async function insertSpecs(products: Product[]): Promise<void> {
  const specsToInsert: ProductKeySpecs[] = [];
  const unmatchedProducts: Product[] = [];

  for (const product of products) {
    const specKey = getSpecKey(product.name);

    if (specKey && smartwatchSpecs[specKey as keyof typeof smartwatchSpecs]) {
      const specs = smartwatchSpecs[specKey as keyof typeof smartwatchSpecs];
      specsToInsert.push({
        product_id: product.id,
        ...specs,
      });
      console.log(`✓ Matched: ${product.name} -> ${specKey}`);
    } else {
      unmatchedProducts.push(product);
      console.log(`✗ No match: ${product.name}`);
    }
  }

  // Batch insert specs
  if (specsToInsert.length > 0) {
    console.log(`\nInserting ${specsToInsert.length} specs...`);

    const { error } = await supabase
      .from('product_key_specs')
      .upsert(specsToInsert, {
        onConflict: 'product_id',
      });

    if (error) {
      console.error('Error inserting specs:', error);
      throw error;
    }

    console.log(`✓ Successfully inserted ${specsToInsert.length} specs!`);
  }

  if (unmatchedProducts.length > 0) {
    console.log(`\n⚠ ${unmatchedProducts.length} products without matching specs:`);
    unmatchedProducts.forEach(p => console.log(`  - ${p.name}`));
  }
}

async function main() {
  console.log('Starting Smartwatch Spec Insertion...\n');

  try {
    const products = await getSmartwatchesWithoutSpecs();
    console.log(`Found ${products.length} smartwatches without specs\n`);

    if (products.length === 0) {
      console.log('All smartwatches already have specs!');
      return;
    }

    console.log('Processing products:\n');
    await insertSpecs(products);

    console.log('\n✓ Done!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run main function
main().catch(console.error);
