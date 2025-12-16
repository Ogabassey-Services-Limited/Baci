import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const RATE_LIMIT_MS = 5000; // 5 seconds between requests

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

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function searchGsmArena(query: string): Promise<string | null> {
  const searchUrl = `https://www.gsmarena.com/results.php3?sQuickSearch=yes&sName=${encodeURIComponent(query)}`;
  try {
    console.log(`   🔍 Searching GSM Arena: ${searchUrl}`);
    const html = await fetchHtml(searchUrl);

    // Find first product link: <div class="makers"><ul><li><a href="...">
    const match = html.match(/<div class="makers">.*?<a href="([^"]+)"/s);
    if (match && match[1]) {
      const fullUrl = `https://www.gsmarena.com/${match[1]}`;
      console.log(`   ✅ Found product page: ${fullUrl}`);
      return fullUrl;
    }
  } catch (e) {
    console.error(`   ❌ Error searching for ${query}:`, e);
  }
  return null;
}

function extractSpecValue(html: string, specName: string): string | null {
  // GSM Arena spec format: <tr><td class="ttl"><a>Display Type</a></td><td class="nfo">AMOLED, 120Hz</td></tr>
  const regex = new RegExp(`<td class="ttl">.*?${specName}.*?</td>\\s*<td class="nfo">([^<]+)`, 'i');
  const match = html.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

function parseScreenSize(text: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+\.?\d*)\s*inches?/i);
  return match ? parseFloat(match[1]) : undefined;
}

function parseRefreshRate(text: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*Hz/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseRam(text: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*GB/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseStorage(text: string | null): number | undefined {
  if (!text) return undefined;
  // Look for storage, prefer GB but handle TB
  const gbMatch = text.match(/(\d+)\s*GB/i);
  const tbMatch = text.match(/(\d+)\s*TB/i);
  if (tbMatch) return parseInt(tbMatch[1]) * 1024;
  if (gbMatch) return parseInt(gbMatch[1]);
  return undefined;
}

function parseCameraMp(text: string | null): number | undefined {
  if (!text) return undefined;
  // Extract first MP value (usually the primary camera)
  const match = text.match(/(\d+)\s*MP/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseBattery(text: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*mAh/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseCharging(text: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*W/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseWeight(text: string | null): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*g/i);
  return match ? parseInt(match[1]) : undefined;
}

function parseColors(text: string | null): string[] | undefined {
  if (!text) return undefined;
  // Colors are usually comma-separated
  const colors = text.split(',').map(c => c.trim()).filter(c => c.length > 0);
  return colors.length > 0 ? colors : undefined;
}

async function scrapeProductSpecs(url: string, productName: string): Promise<Partial<ProductKeySpecs> | null> {
  try {
    console.log(`   📄 Scraping specs from page...`);
    const html = await fetchHtml(url);

    const specs: Partial<ProductKeySpecs> = {};

    // Extract all specs
    const sizeText = extractSpecValue(html, 'Size');
    specs.screen_size_inches = parseScreenSize(sizeText);

    const displayTypeText = extractSpecValue(html, 'Type');
    specs.display_type = displayTypeText || undefined;
    specs.refresh_rate_hz = parseRefreshRate(displayTypeText);

    const resolutionText = extractSpecValue(html, 'Resolution');
    specs.display_resolution = resolutionText || undefined;

    const chipsetText = extractSpecValue(html, 'Chipset');
    specs.chipset = chipsetText || undefined;

    const memoryText = extractSpecValue(html, 'Internal');
    specs.ram_gb = parseRam(memoryText);
    specs.storage_gb = parseStorage(memoryText);

    const mainCameraText = extractSpecValue(html, 'Main Camera');
    if (!mainCameraText) {
      const singleText = extractSpecValue(html, 'Single');
      const tripleText = extractSpecValue(html, 'Triple');
      const quadText = extractSpecValue(html, 'Quad');
      specs.main_camera_mp = parseCameraMp(mainCameraText || singleText || tripleText || quadText);
    } else {
      specs.main_camera_mp = parseCameraMp(mainCameraText);
    }

    // Check for OIS
    const cameraFeaturesText = extractSpecValue(html, 'Features');
    specs.has_ois = cameraFeaturesText?.toLowerCase().includes('ois') || false;

    const selfieText = extractSpecValue(html, 'Single');
    if (!selfieText) {
      const dualText = extractSpecValue(html, 'Dual');
      specs.front_camera_mp = parseCameraMp(selfieText || dualText);
    } else {
      specs.front_camera_mp = parseCameraMp(selfieText);
    }

    const batteryText = extractSpecValue(html, 'Type');
    specs.battery_mah = parseBattery(batteryText);

    const chargingText = extractSpecValue(html, 'Charging');
    specs.charging_watt = parseCharging(chargingText);
    specs.has_wireless_charging = chargingText?.toLowerCase().includes('wireless') || false;

    // Network
    const networkText = extractSpecValue(html, 'Technology');
    specs.is_5g = networkText?.toLowerCase().includes('5g') || false;

    // NFC
    const commsText = extractSpecValue(html, 'NFC');
    specs.has_nfc = commsText?.toLowerCase().includes('yes') || false;

    // Weight
    const weightText = extractSpecValue(html, 'Weight');
    specs.weight_g = parseWeight(weightText);

    // IP Rating - look in "Build" section
    const buildText = extractSpecValue(html, 'Build');
    const ipMatch = buildText?.match(/IP\d{2}/i);
    specs.ip_rating = ipMatch ? ipMatch[0] : undefined;

    // Colors
    const colorsText = extractSpecValue(html, 'Colors');
    specs.available_colors = parseColors(colorsText);

    // Release Date - look in "Status" section
    const statusText = extractSpecValue(html, 'Status');
    if (statusText) {
      // Format: "Available. Released 2024, October"
      const dateMatch = statusText.match(/(\d{4}),?\s*(\w+)?/);
      if (dateMatch) {
        const year = dateMatch[1];
        const month = dateMatch[2];
        specs.release_date = month ? `${year}-${month}` : year;
      }
    }

    console.log(`   ✅ Scraped specs:`, specs);
    return specs;

  } catch (e) {
    console.error(`   ❌ Error scraping specs:`, e);
    return null;
  }
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

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Starting Google & Xiaomi Phone Spec Scraping...\n');

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

  console.log(`\n📋 Processing ${productsToProcess.length} products without specs\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < productsToProcess.length; i++) {
    const product = productsToProcess[i];
    console.log(`\n[${i + 1}/${productsToProcess.length}] Processing: ${product.name}`);
    console.log(`   Brand: ${product.brand}`);
    console.log(`   Category: ${product.category}`);

    // Clean product name for search
    const cleanName = cleanProductName(product.name, product.brand);
    let searchQuery = `${product.brand} ${cleanName}`;

    // Special handling for Google Pixel
    if (product.brand.toLowerCase().includes('google')) {
      searchQuery = `Google Pixel ${cleanName}`;
    }
    // Special handling for Redmi (add Xiaomi for better search)
    else if (product.brand.toLowerCase().includes('redmi')) {
      searchQuery = `Xiaomi Redmi ${cleanName}`;
    }

    console.log(`   🔎 Search query: "${searchQuery}"`);

    // Search GSM Arena
    const productUrl = await searchGsmArena(searchQuery);

    if (!productUrl) {
      console.log(`   ❌ No GSM Arena page found`);
      failCount++;

      // Rate limit even on failure
      if (i < productsToProcess.length - 1) {
        console.log(`   ⏱️  Waiting ${RATE_LIMIT_MS / 1000}s...`);
        await wait(RATE_LIMIT_MS);
      }
      continue;
    }

    // Scrape specs
    await wait(2000); // Small delay before scraping
    const specs = await scrapeProductSpecs(productUrl, product.name);

    if (!specs || Object.keys(specs).length === 0) {
      console.log(`   ❌ No specs extracted`);
      failCount++;
    } else {
      // Insert into database
      const specsToInsert: ProductKeySpecs = {
        product_id: product.id,
        ...specs
      };

      const { error: insertError } = await supabase
        .from('product_key_specs')
        .insert(specsToInsert);

      if (insertError) {
        console.error(`   ❌ Database insert error:`, insertError);
        failCount++;
      } else {
        console.log(`   ✅ Successfully inserted specs into database`);
        successCount++;
      }
    }

    // Rate limit between requests
    if (i < productsToProcess.length - 1) {
      console.log(`   ⏱️  Waiting ${RATE_LIMIT_MS / 1000}s before next request...`);
      await wait(RATE_LIMIT_MS);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Success Rate: ${productsToProcess.length > 0 ? ((successCount / productsToProcess.length) * 100).toFixed(1) : 0}%`);
  console.log('='.repeat(60));
}

run().catch(console.error);
