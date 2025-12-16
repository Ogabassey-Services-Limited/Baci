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

interface ProductKeySpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  refresh_rate_hz?: number;
  display_resolution?: string;
  display_ppi?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  main_camera_mp?: number;
  front_camera_mp?: number;
  has_ois?: boolean;
  has_triple_camera?: boolean;
  has_quad_camera?: boolean;
  battery_mah?: number;
  charging_watt?: number;
  has_wireless_charging?: boolean;
  has_reverse_charging?: boolean;
  has_nfc?: boolean;
  is_5g?: boolean;
  weight_g?: number;
  dimensions_mm?: string;
  ip_rating?: string;
  available_colors?: string[];
  release_date?: string;
}

async function getSamsungPhonesWithoutSpecs(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%phone%')
    .ilike('brand', '%samsung%')
    .limit(20);

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

  return productsWithoutSpecs;
}

function parseGSMArenaSpecs(htmlContent: string): Partial<ProductKeySpecs> {
  const specs: Partial<ProductKeySpecs> = {};

  // Extract screen size
  const screenSizeMatch = htmlContent.match(/(\d+\.?\d*)\s*(?:inches|")/i);
  if (screenSizeMatch) {
    specs.screen_size_inches = parseFloat(screenSizeMatch[1]);
  }

  // Extract display type
  const displayTypeMatch = htmlContent.match(/(Dynamic AMOLED|Super AMOLED|AMOLED|LCD|IPS|PLS)/i);
  if (displayTypeMatch) {
    specs.display_type = displayTypeMatch[1];
  }

  // Extract refresh rate
  const refreshRateMatch = htmlContent.match(/(\d+)\s*Hz/i);
  if (refreshRateMatch) {
    specs.refresh_rate_hz = parseInt(refreshRateMatch[1]);
  }

  // Extract resolution
  const resolutionMatch = htmlContent.match(/(\d+\s*x\s*\d+)/i);
  if (resolutionMatch) {
    specs.display_resolution = resolutionMatch[1].replace(/\s/g, '');
  }

  // Extract PPI
  const ppiMatch = htmlContent.match(/(\d+)\s*ppi/i);
  if (ppiMatch) {
    specs.display_ppi = parseInt(ppiMatch[1]);
  }

  // Extract chipset - Samsung specific patterns
  const chipsetMatch = htmlContent.match(/(Exynos\s+\d+|Snapdragon\s+\d+\s*(?:Gen\s*\d+)?|Dimensity\s+\d+)/i);
  if (chipsetMatch) {
    specs.chipset = chipsetMatch[1];
  }

  // Extract RAM
  const ramMatch = htmlContent.match(/(\d+)\s*GB\s*RAM/i);
  if (ramMatch) {
    specs.ram_gb = parseInt(ramMatch[1]);
  }

  // Extract storage
  const storageMatch = htmlContent.match(/(\d+)\s*GB(?:\s*storage|\s*ROM)?/i);
  if (storageMatch && parseInt(storageMatch[1]) >= 32) { // Filter out small numbers
    specs.storage_gb = parseInt(storageMatch[1]);
  }

  // Extract main camera - look for highest MP count
  const mainCameraMatches = htmlContent.match(/(\d+)\s*MP/gi);
  if (mainCameraMatches) {
    const mpValues = mainCameraMatches.map(m => parseInt(m.match(/(\d+)/)![1]));
    specs.main_camera_mp = Math.max(...mpValues.filter(v => v > 5)); // Filter out small values
  }

  // Extract front camera
  const frontCameraMatch = htmlContent.match(/(\d+)\s*MP.*(?:front|selfie)/i);
  if (frontCameraMatch) {
    specs.front_camera_mp = parseInt(frontCameraMatch[1]);
  }

  // Check for OIS
  specs.has_ois = /OIS/i.test(htmlContent);

  // Check camera count
  const tripleMatch = /triple\s*camera/i.test(htmlContent);
  const quadMatch = /quad\s*camera/i.test(htmlContent);
  specs.has_triple_camera = tripleMatch;
  specs.has_quad_camera = quadMatch;

  // Extract battery
  const batteryMatch = htmlContent.match(/(\d+)\s*mAh/i);
  if (batteryMatch) {
    specs.battery_mah = parseInt(batteryMatch[1]);
  }

  // Extract charging wattage
  const chargingMatch = htmlContent.match(/(\d+)\s*W(?:\s*charging)?/i);
  if (chargingMatch && parseInt(chargingMatch[1]) <= 200) { // Filter unreasonable values
    specs.charging_watt = parseInt(chargingMatch[1]);
  }

  // Check for wireless charging
  specs.has_wireless_charging = /wireless\s*charging/i.test(htmlContent);
  specs.has_reverse_charging = /reverse\s*(?:wireless\s*)?charging/i.test(htmlContent);

  // Check for NFC
  specs.has_nfc = /\bNFC\b/i.test(htmlContent);

  // Check for 5G
  specs.is_5g = /\b5G\b/i.test(htmlContent);

  // Extract weight
  const weightMatch = htmlContent.match(/(\d+)\s*g(?:rams)?/i);
  if (weightMatch && parseInt(weightMatch[1]) > 50 && parseInt(weightMatch[1]) < 500) {
    specs.weight_g = parseInt(weightMatch[1]);
  }

  // Extract dimensions
  const dimensionsMatch = htmlContent.match(/(\d+\.?\d*\s*x\s*\d+\.?\d*\s*x\s*\d+\.?\d*)\s*mm/i);
  if (dimensionsMatch) {
    specs.dimensions_mm = dimensionsMatch[1].replace(/\s/g, '');
  }

  // Extract IP rating
  const ipRatingMatch = htmlContent.match(/IP(\d{2})/i);
  if (ipRatingMatch) {
    specs.ip_rating = `IP${ipRatingMatch[1]}`;
  }

  // Extract colors
  const colorsMatch = htmlContent.match(/(?:colors?|available in)[:]\s*([^.\n]+)/i);
  if (colorsMatch) {
    const colorString = colorsMatch[1];
    specs.available_colors = colorString
      .split(/[,;]/)
      .map(c => c.trim())
      .filter(c => c.length > 0 && c.length < 30);
  }

  // Extract release date
  const releaseDateMatch = htmlContent.match(/(?:released|announced).*?(\d{4})/i);
  if (releaseDateMatch) {
    specs.release_date = releaseDateMatch[1];
  }

  return specs;
}

async function insertSpecs(productId: string, specs: Partial<ProductKeySpecs>): Promise<boolean> {
  const specsToInsert: ProductKeySpecs = {
    product_id: productId,
    ...specs,
  };

  const { error } = await supabase
    .from('product_key_specs')
    .insert(specsToInsert);

  if (error) {
    console.error(`Error inserting specs for product ${productId}:`, error);
    return false;
  }

  return true;
}

async function main() {
  console.log('Starting Samsung phone spec population...\n');
  console.log('This script needs to be run with WebFetch tool integration');
  console.log('to scrape GSM Arena data.\n');

  try {
    const products = await getSamsungPhonesWithoutSpecs();
    console.log(`Found ${products.length} Samsung phones without specs\n`);

    if (products.length === 0) {
      console.log('All Samsung phones already have specs populated!');
      return;
    }

    console.log('Products to process:');
    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (${p.id})`);
    });

    console.log('\n--- Instructions ---');
    console.log('To populate specs, this script needs to:');
    console.log('1. Use WebFetch to search GSM Arena for each product');
    console.log('2. Parse the specs from the results');
    console.log('3. Insert them into the database');
    console.log('\nThis requires running through an agent with WebFetch capability.');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { getSamsungPhonesWithoutSpecs, parseGSMArenaSpecs, insertSpecs };
