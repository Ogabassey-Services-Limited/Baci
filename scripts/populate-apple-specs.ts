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

interface SpecData {
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
  battery_mah?: number;
  charging_watt?: number;
  has_wireless_charging?: boolean;
  has_nfc?: boolean;
  is_5g?: boolean;
  weight_g?: number;
  dimensions_mm?: string;
  ip_rating?: string;
  available_colors?: string[];
  release_date?: string;
}

// Helper to clean and parse numbers
function parseNumber(text: string): number | undefined {
  const match = text.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : undefined;
}

// Helper to extract specs from GSM Arena HTML
function extractSpecs(html: string, productName: string): Partial<SpecData> {
  const specs: Partial<SpecData> = {};
  const lowerHtml = html.toLowerCase();

  // Display specs
  const screenMatch = html.match(/(\d+\.?\d*)\s*inches/i);
  if (screenMatch) specs.screen_size_inches = parseFloat(screenMatch[1]);

  // Display type
  if (lowerHtml.includes('oled') || lowerHtml.includes('super retina')) {
    const typeMatch = html.match(/Super Retina[^<]*/i);
    specs.display_type = typeMatch ? typeMatch[0].trim() : 'OLED';
  } else if (lowerHtml.includes('liquid retina')) {
    specs.display_type = 'Liquid Retina (LCD)';
  }

  // Refresh rate
  const refreshMatch = html.match(/(\d+)\s*Hz/i);
  if (refreshMatch) specs.refresh_rate_hz = parseInt(refreshMatch[1]);

  // Resolution
  const resMatch = html.match(/(\d+)\s*x\s*(\d+)\s*pixels/i);
  if (resMatch) specs.display_resolution = `${resMatch[1]}x${resMatch[2]}`;

  // PPI
  const ppiMatch = html.match(/(\d+)\s*ppi/i);
  if (ppiMatch) specs.display_ppi = parseInt(ppiMatch[1]);

  // Chipset - Apple A-series
  const chipMatch = html.match(/Apple\s+A\d+[^<]*/i);
  if (chipMatch) {
    specs.chipset = chipMatch[0].replace(/Bionic.*/, 'Bionic').trim();
  }

  // RAM - GSM Arena doesn't always list iPhone RAM, extract from product name if available
  const ramFromName = productName.match(/(\d+)GB(?:\s|$)/i);
  if (ramFromName) {
    const ramValue = parseInt(ramFromName[1]);
    // Only if it's reasonable RAM size (4-16GB)
    if (ramValue >= 3 && ramValue <= 16) {
      specs.ram_gb = ramValue;
    }
  }

  // If not in name, try to extract from HTML
  if (!specs.ram_gb) {
    const ramMatch = html.match(/(\d+)\s*GB\s*RAM/i);
    if (ramMatch) specs.ram_gb = parseInt(ramMatch[1]);
  }

  // Storage - extract from product name
  const storageMatch = productName.match(/(\d+)GB/i);
  if (storageMatch) {
    const storageValue = parseInt(storageMatch[1]);
    // If it's a reasonable storage size (64GB+)
    if (storageValue >= 64) {
      specs.storage_gb = storageValue;
    }
  }

  // Camera - main
  const mainCamMatch = html.match(/(\d+)\s*MP[^<]*(?:main|wide|primary)/i);
  if (mainCamMatch) {
    specs.main_camera_mp = parseInt(mainCamMatch[1]);
  } else {
    // Try alternative pattern
    const altMatch = html.match(/(\d+)\s*MP.*?f\/[\d.]+/i);
    if (altMatch) specs.main_camera_mp = parseInt(altMatch[1]);
  }

  // Front camera
  const frontCamMatch = html.match(/(\d+)\s*MP.*?(?:front|selfie)/i);
  if (frontCamMatch) {
    specs.front_camera_mp = parseInt(frontCamMatch[1]);
  }

  specs.has_ois = lowerHtml.includes('ois') || lowerHtml.includes('optical image stabilization');

  // Triple camera check
  const cameraCount = (html.match(/\d+\s*MP/gi) || []).length;
  specs.has_triple_camera = cameraCount >= 3;

  // Battery
  const batteryMatch = html.match(/(\d+)\s*mAh/i);
  if (batteryMatch) specs.battery_mah = parseInt(batteryMatch[1]);

  // Charging
  const chargingMatch = html.match(/(\d+)\s*W/i);
  if (chargingMatch) specs.charging_watt = parseInt(chargingMatch[1]);

  specs.has_wireless_charging = lowerHtml.includes('wireless') || lowerHtml.includes('magsafe');
  specs.has_nfc = true; // All iPhones have NFC
  specs.is_5g = lowerHtml.includes('5g');

  // Physical specs
  const weightMatch = html.match(/(\d+)\s*g\s*(?:\(|<)/i);
  if (weightMatch) specs.weight_g = parseInt(weightMatch[1]);

  // Dimensions
  const dimMatch = html.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*x\s*(\d+\.?\d*)\s*mm/i);
  if (dimMatch) specs.dimensions_mm = `${dimMatch[1]}x${dimMatch[2]}x${dimMatch[3]}`;

  // IP rating
  const ipMatch = html.match(/IP\d+/i);
  if (ipMatch) specs.ip_rating = ipMatch[0].toUpperCase();

  // Colors - try to extract from specifications
  const colorSection = html.match(/(?:Colors?|Available in)[^<]*(?:<[^>]*>)?([^<]+)/i);
  if (colorSection) {
    const colors = colorSection[1]
      .split(/,|;/)
      .map(c => c.trim())
      .filter(c => c.length > 0 && c.length < 30);
    if (colors.length > 0) specs.available_colors = colors;
  }

  // Release date
  const releasedMatch = html.match(/Released\s+(\d{4})/i);
  if (releasedMatch) {
    specs.release_date = releasedMatch[1];
  } else {
    const announcedMatch = html.match(/Announced\s+(\d{4})/i);
    if (announcedMatch) specs.release_date = announcedMatch[1];
  }

  return specs;
}

async function getApplePhonesWithoutSpecs(): Promise<Product[]> {
  console.log('Fetching Apple phones without specs...\n');

  // Get all existing spec product IDs
  const { data: existingSpecs } = await supabase
    .from('product_key_specs')
    .select('product_id');

  const specProductIds = existingSpecs?.map(s => s.product_id) || [];

  // Query for Apple phones
  let query = supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%phone%')
    .ilike('brand', '%apple%')
    .neq('status', 'archived');

  // Exclude products that already have specs
  if (specProductIds.length > 0) {
    query = query.not('id', 'in', `(${specProductIds.join(',')})`);
  }

  const { data, error } = await query.limit(20);

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} Apple phones without specs\n`);
  return data || [];
}

async function scrapeGSMArena(productName: string): Promise<string | null> {
  console.log(`  Searching GSM Arena for: ${productName}`);

  // Clean the product name for search
  const searchName = productName
    .replace(/\d+GB/gi, '') // Remove storage size
    .replace(/\(.*?\)/g, '') // Remove parentheses content
    .replace(/Physical \+ Esim/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const searchUrl = `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(searchName)}`;

  try {
    const response = await fetch(searchUrl);
    const html = await response.text();

    // Check if we have search results
    if (html.includes('No results found')) {
      console.log(`  No results found on GSM Arena`);
      return null;
    }

    // Extract the first result link
    const linkMatch = html.match(/<a href="([^"]+\.php)">.*?<span>/);
    if (!linkMatch) {
      console.log(`  Could not find product page link`);
      return null;
    }

    const productPageUrl = `https://www.gsmarena.com/${linkMatch[1]}`;
    console.log(`  Found product page: ${productPageUrl}`);

    // Fetch the product page
    const productResponse = await fetch(productPageUrl);
    const productHtml = await productResponse.text();

    return productHtml;
  } catch (error) {
    console.error(`  Error scraping: ${error}`);
    return null;
  }
}

async function insertSpecs(specs: SpecData): Promise<boolean> {
  const { error } = await supabase
    .from('product_key_specs')
    .insert(specs);

  if (error) {
    console.error(`  Error inserting specs: ${error.message}`);
    return false;
  }

  return true;
}

async function processProduct(product: Product): Promise<boolean> {
  console.log(`\nProcessing: ${product.brand} ${product.name}`);

  // Try GSM Arena first
  let specText = await scrapeGSMArena(product.name);

  // If GSM Arena fails, we would use WebSearch here
  // For now, we'll create placeholder specs for Apple products
  if (!specText) {
    console.log('  Could not fetch specs, skipping...');
    return false;
  }

  // Extract specs from the scraped text
  const specs: SpecData = {
    product_id: product.id,
    has_nfc: true, // All iPhones have NFC
    ...extractSpecs(specText, product.name)
  };

  // Insert into database
  const success = await insertSpecs(specs);

  if (success) {
    console.log('  ✓ Specs inserted successfully');
  }

  return success;
}

async function main() {
  console.log('=== Apple Phone Spec Scraper ===\n');

  const products = await getApplePhonesWithoutSpecs();

  if (products.length === 0) {
    console.log('No Apple phones found without specs!');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < products.length; i++) {
    const product = products[i];

    // Rate limiting: wait 5 seconds between requests (except for first)
    if (i > 0) {
      console.log('\nWaiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const success = await processProduct(product);

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total processed: ${products.length}`);
  console.log(`Successes: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Success rate: ${((successCount / products.length) * 100).toFixed(1)}%`);
}

main().catch(console.error);
