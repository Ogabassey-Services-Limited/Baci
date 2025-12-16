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
}

interface KeySpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  refresh_rate_hz?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  main_camera_mp?: number;
  front_camera_mp?: number;
  battery_mah?: number;
  charging_watt?: number;
  has_nfc?: boolean;
  is_5g?: boolean;
  weight_g?: number;
  available_colors?: string[];
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Parse specs from GSM Arena text
function parseGSMArenaSpecs(text: string): Partial<KeySpecs> {
  const specs: Partial<KeySpecs> = {};

  // Screen size (e.g., "6.6 inches", "6.78\"")
  const screenMatch = text.match(/(\d+\.?\d*)\s*(?:inches|"|'')/i);
  if (screenMatch) {
    specs.screen_size_inches = parseFloat(screenMatch[1]);
  }

  // Display type (AMOLED, IPS LCD, etc.)
  const displayTypes = ['AMOLED', 'Super AMOLED', 'IPS LCD', 'LCD', 'LTPS', 'PLS'];
  for (const type of displayTypes) {
    if (text.match(new RegExp(type, 'i'))) {
      specs.display_type = type;
      break;
    }
  }

  // Refresh rate
  const refreshMatch = text.match(/(\d+)\s*Hz/i);
  if (refreshMatch) {
    const rate = parseInt(refreshMatch[1]);
    if (rate >= 60 && rate <= 165) {
      specs.refresh_rate_hz = rate;
    }
  }

  // Chipset (MediaTek, Unisoc, Snapdragon, etc.)
  const chipsetMatch = text.match(/(MediaTek\s+[\w\s]+\d+|Unisoc\s+[\w\s]+\d+|Snapdragon\s+\d+|Helio\s+[A-Z]\d+|Dimensity\s+\d+)/i);
  if (chipsetMatch) {
    specs.chipset = chipsetMatch[1].trim();
  }

  // RAM (e.g., "4GB", "6 GB", "8GB RAM")
  const ramMatch = text.match(/(\d+)\s*GB\s*(?:RAM)?/i);
  if (ramMatch) {
    specs.ram_gb = parseInt(ramMatch[1]);
  }

  // Storage (e.g., "64GB", "128 GB", "256GB ROM")
  const storageMatch = text.match(/(\d+)\s*GB\s*(?:ROM|storage)?/i);
  if (storageMatch) {
    specs.storage_gb = parseInt(storageMatch[1]);
  }

  // Main camera (e.g., "50MP", "108 MP main")
  const mainCamMatch = text.match(/(\d+)\s*MP(?:\s+(?:main|primary|camera))?/i);
  if (mainCamMatch) {
    specs.main_camera_mp = parseInt(mainCamMatch[1]);
  }

  // Front camera (e.g., "16MP selfie", "8MP front")
  const frontCamMatch = text.match(/(\d+)\s*MP\s*(?:selfie|front)/i);
  if (frontCamMatch) {
    specs.front_camera_mp = parseInt(frontCamMatch[1]);
  }

  // Battery (e.g., "5000mAh", "6000 mAh")
  const batteryMatch = text.match(/(\d+)\s*mAh/i);
  if (batteryMatch) {
    specs.battery_mah = parseInt(batteryMatch[1]);
  }

  // Charging wattage (e.g., "33W", "18W fast charging")
  const chargingMatch = text.match(/(\d+)\s*W(?:\s+(?:fast\s+)?charging)?/i);
  if (chargingMatch) {
    specs.charging_watt = parseInt(chargingMatch[1]);
  }

  // NFC
  specs.has_nfc = /\bNFC\b/i.test(text);

  // 5G
  specs.is_5g = /\b5G\b/i.test(text);

  // Weight (e.g., "195g", "200 grams")
  const weightMatch = text.match(/(\d+)\s*(?:g|grams)/i);
  if (weightMatch) {
    specs.weight_g = parseInt(weightMatch[1]);
  }

  // Colors
  const colorMatch = text.match(/(?:colors?|available in):\s*([^.\n]+)/i);
  if (colorMatch) {
    const colors = colorMatch[1].split(/[,;]/).map(c => c.trim()).filter(Boolean);
    if (colors.length > 0) {
      specs.available_colors = colors;
    }
  }

  return specs;
}

async function fetchProductsWithoutSpecs(): Promise<Product[]> {
  console.log('Fetching products without specs...\n');

  const { data, error } = await supabase.rpc('get_phones_without_specs', {
    brand_filter: '%infinix%,%tecno%,%vivo%,%itel%,%oppo%',
    limit_count: 20
  });

  if (error) {
    console.error('RPC error, using direct query instead');

    // Fallback to direct query
    const { data: products, error: queryError } = await supabase
      .from('products')
      .select('id, name, brand')
      .ilike('category', '%phone%')
      .or('brand.ilike.%infinix%,brand.ilike.%tecno%,brand.ilike.%vivo%,brand.ilike.%itel%,brand.ilike.%oppo%')
      .limit(20);

    if (queryError) {
      console.error('Query error:', queryError);
      return [];
    }

    // Filter out products that already have specs
    const productsToCheck = products || [];
    const filtered: Product[] = [];

    for (const product of productsToCheck) {
      const { data: existingSpecs } = await supabase
        .from('product_key_specs')
        .select('id')
        .eq('product_id', product.id)
        .single();

      if (!existingSpecs) {
        filtered.push(product);
      }
    }

    return filtered;
  }

  return data || [];
}

async function insertSpecs(specs: KeySpecs): Promise<boolean> {
  const { error } = await supabase
    .from('product_key_specs')
    .insert(specs);

  if (error) {
    console.error('Error inserting specs:', error);
    return false;
  }

  return true;
}

async function processProduct(product: Product, index: number, total: number): Promise<void> {
  console.log(`\n[${index + 1}/${total}] Processing: ${product.brand} ${product.name}`);
  console.log(`Product ID: ${product.id}`);

  // Search GSM Arena
  const searchQuery = `${product.brand} ${product.name}`.replace(/\s+/g, '+');
  const gsmArenaUrl = `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${searchQuery}`;

  console.log(`Searching GSM Arena: ${gsmArenaUrl}`);

  try {
    // Note: Since we can't directly fetch web content in this environment,
    // we'll use a placeholder approach. In production, you'd use WebFetch or similar
    console.log('⚠️  Web scraping not available in script environment');
    console.log('Please use WebFetch tool or implement HTTP client');

    // For now, we'll create a manual fallback structure
    console.log('Skipping - requires web scraping capability');

  } catch (error) {
    console.error('Error processing product:', error);
  }

  // Rate limiting - wait 5 seconds between requests
  if (index < total - 1) {
    console.log('Waiting 5 seconds before next request...');
    await sleep(5000);
  }
}

async function main() {
  console.log('=== Other Phone Brands Spec Scraper ===');
  console.log('Brands: Infinix, Tecno, vivo, itel, Oppo\n');

  const products = await fetchProductsWithoutSpecs();

  if (products.length === 0) {
    console.log('No products found without specs!');
    return;
  }

  console.log(`Found ${products.length} products to process\n`);

  for (let i = 0; i < products.length; i++) {
    await processProduct(products[i], i, products.length);
  }

  console.log('\n=== Processing Complete ===');
}

main().catch(console.error);
