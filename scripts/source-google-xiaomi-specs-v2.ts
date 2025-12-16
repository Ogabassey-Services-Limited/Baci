import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RATE_LIMIT_MS = 10000; // 10 seconds between requests

interface ProductKeySpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  refresh_rate_hz?: number;
  display_resolution?: string;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  main_camera_mp?: number;
  front_camera_mp?: number;
  has_ois?: boolean;
  battery_mah?: number;
  charging_watt?: number;
  has_wireless_charging?: boolean;
  has_nfc?: boolean;
  is_5g?: boolean;
  weight_g?: number;
  ip_rating?: string;
  available_colors?: string[];
  release_date?: string;
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
}

function cleanProductName(name: string, brand: string): string {
  // Remove brand, conditions, storage info, and parentheses
  let cleaned = name
    .replace(new RegExp(brand, 'gi'), '')
    .replace(/\(.*?\)/g, '')
    .replace(/(Brand )?(New|Used|Open Box|Refurbished|Grade [A-C])/gi, '')
    .replace(/\d+GB|\d+TB/gi, '')
    .replace(/\d+mm/gi, '')
    .replace(/Pixel/gi, '') // Remove "Pixel" to avoid duplication in search
    .trim();

  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

function buildSearchQuery(product: Product): string {
  const cleanName = cleanProductName(product.name, product.brand);

  // Special handling for Google Pixel
  if (product.brand.toLowerCase().includes('google')) {
    return `Google Pixel ${cleanName}`;
  }
  // Special handling for Redmi (add Xiaomi for better search)
  else if (product.brand.toLowerCase().includes('redmi')) {
    return `Xiaomi Redmi ${cleanName}`;
  }

  return `${product.brand} ${cleanName}`;
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Starting Google & Xiaomi Phone Spec Scraping (Manual Mode)...\n');
  console.log('⚠️  Due to rate limiting, you will need to manually provide GSM Arena URLs\n');

  // Query for products without specs
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, brand, category')
    .or('brand.ilike.%google%,brand.ilike.%xiaomi%,brand.ilike.%redmi%')
    .ilike('category', '%phone%')
    .limit(20);

  if (error) {
    console.error('❌ Database error:', error);
    return;
  }

  if (!products || products.length === 0) {
    console.log('✅ No products found matching criteria.');
    return;
  }

  console.log(`📊 Found ${products.length} Google/Xiaomi phones\n`);

  // Filter out products that already have specs
  const productsToProcess = [];
  for (const product of products) {
    const { data: existingSpecs } = await supabase
      .from('product_key_specs')
      .select('id')
      .eq('product_id', product.id)
      .single();

    if (!existingSpecs) {
      productsToProcess.push(product);
    } else {
      console.log(`⏭️  Skipping ${product.name} - already has specs`);
    }
  }

  console.log(`\n📋 ${productsToProcess.length} products need specs:\n`);
  console.log('=' .repeat(80));

  // Print the list with search queries
  for (let i = 0; i < productsToProcess.length; i++) {
    const product = productsToProcess[i];
    const searchQuery = buildSearchQuery(product);
    const searchUrl = `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(searchQuery)}`;

    console.log(`\n[${i + 1}/${productsToProcess.length}] ${product.name}`);
    console.log(`    Brand: ${product.brand}`);
    console.log(`    Search: "${searchQuery}"`);
    console.log(`    URL: ${searchUrl}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📝 NEXT STEPS:');
  console.log('1. Visit each GSM Arena search URL above');
  console.log('2. Find the correct product page');
  console.log('3. Use WebFetch tool to extract specs from the product page');
  console.log('4. Insert specs into database\n');

  // Export the product list for easy reference
  const productList = productsToProcess.map((p, i) => ({
    index: i + 1,
    id: p.id,
    name: p.name,
    brand: p.brand,
    searchQuery: buildSearchQuery(p),
    searchUrl: `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(buildSearchQuery(p))}`
  }));

  console.log('\n📄 Product list exported below:\n');
  console.log(JSON.stringify(productList, null, 2));
}

run().catch(console.error);
