import { createAdminClient } from '@/lib/supabase/admin';

interface Product {
  id: string;
  name: string;
  brand: string;
}

interface LaptopSpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  display_resolution?: string;
  refresh_rate_hz?: number;
  display_peak_brightness?: number;
  chipset?: string;
  ram_gb?: number;
  storage_gb?: number;
  battery_mah?: number;
  weight_g?: number;
  dimensions_mm?: string;
  has_headphone_jack?: boolean;
  has_nfc?: boolean;
  is_5g?: boolean;
  has_wireless_charging?: boolean;
}

// Helper to convert Wh to mAh (assuming ~11.4V battery)
function whToMah(wh: number): number {
  return Math.round((wh * 1000) / 11.4);
}

// Extract MacBook model info from name
function parseModelName(name: string): {
  modelType: 'Air' | 'Pro' | 'Unknown';
  screenSize?: number;
  chip?: string;
  ram?: number;
  storage?: number;
} {
  const result: ReturnType<typeof parseModelName> = {
    modelType: 'Unknown',
  };

  // Check if Air or Pro
  if (name.includes('Air')) result.modelType = 'Air';
  else if (name.includes('Pro')) result.modelType = 'Pro';

  // Extract screen size (13, 14, 15, 16)
  const sizeMatch = name.match(/(\d{2})["\s-]/);
  if (sizeMatch) {
    const size = parseInt(sizeMatch[1]);
    if (size === 13) result.screenSize = 13.6;
    else if (size === 14) result.screenSize = 14.2;
    else if (size === 15) result.screenSize = 15.3;
    else if (size === 16) result.screenSize = 16.2;
  }

  // Extract chip (M1, M2, M3, M4, Pro, Max, Ultra)
  const chipMatch = name.match(/M(\d)(\s+(Pro|Max|Ultra))?/i);
  if (chipMatch) {
    result.chip = `M${chipMatch[1]}`;
    if (chipMatch[3]) result.chip += ` ${chipMatch[3]}`;
  }

  // Extract RAM and storage
  // Look for patterns like "16GB 512GB", "8GB 256GB", "48GB 1TB", "32GB 2TB"
  // Also handle "16GB RAM" or "512GB SSD" patterns

  // Check for TB storage first
  const tbMatch = name.match(/(\d+)TB/i);
  if (tbMatch) {
    result.storage = parseInt(tbMatch[1]) * 1000;
  }

  // Get all GB values
  const memoryMatches = name.match(/(\d+)GB/gi);
  if (memoryMatches) {
    // Parse the numbers
    const gbValues = memoryMatches.map(m => parseInt(m));

    if (gbValues.length === 1) {
      // Only one GB value
      if (result.storage) {
        // We already have storage from TB, so this must be RAM
        result.ram = gbValues[0];
      } else {
        // Could be either, but likely storage if > 32
        if (gbValues[0] > 32) {
          result.storage = gbValues[0];
        } else {
          // Could be RAM or storage, default to storage
          result.storage = gbValues[0];
        }
      }
    } else if (gbValues.length >= 2) {
      // Multiple GB values - first is RAM, second is storage
      result.ram = gbValues[0];
      if (!result.storage) {
        result.storage = gbValues[1];
      }
    }
  }

  return result;
}

// Get specs for a MacBook based on model info
function getSpecsFromModel(name: string): Partial<LaptopSpecs> {
  const parsed = parseModelName(name);
  const specs: Partial<LaptopSpecs> = {
    has_headphone_jack: true,
    has_nfc: false,
    is_5g: false,
    has_wireless_charging: false,
  };

  // Handle special case: "MacBook Air M4" - assume base model
  if (name.includes('Air M4') && !name.match(/\d+GB/)) {
    parsed.screenSize = 13.6;
    parsed.ram = 8;
    parsed.storage = 256;
  }

  // Screen size
  if (parsed.screenSize) {
    specs.screen_size_inches = parsed.screenSize;
  }

  // Chip
  if (parsed.chip) {
    specs.chipset = parsed.chip;
  }

  // RAM
  if (parsed.ram) {
    specs.ram_gb = parsed.ram;
  }

  // Storage
  if (parsed.storage) {
    specs.storage_gb = parsed.storage;
  }

  // Display type and refresh rate based on model
  if (parsed.modelType === 'Pro') {
    // Check if it's a newer model with XDR display (14" and 16" from 2021+)
    if (parsed.screenSize === 14.2 || parsed.screenSize === 16.2) {
      specs.display_type = 'Liquid Retina XDR';
      specs.refresh_rate_hz = 120; // ProMotion
    } else {
      // Older Pro models or 13-inch Pro
      specs.display_type = 'Retina Display';
      specs.refresh_rate_hz = 60;
    }
  } else if (parsed.modelType === 'Air') {
    specs.display_type = 'Liquid Retina';
    specs.refresh_rate_hz = 60;
  }

  // Display resolution based on screen size and model
  if (parsed.screenSize === 13.6) {
    if (parsed.modelType === 'Air') {
      specs.display_resolution = '2560x1664';
    } else {
      // 13-inch Pro
      specs.display_resolution = '2560x1600';
    }
  } else if (parsed.screenSize === 14.2) {
    specs.display_resolution = '3024x1964';
  } else if (parsed.screenSize === 15.3) {
    // 15-inch Pro (Intel)
    specs.display_resolution = '2880x1800';
  } else if (parsed.screenSize === 16.2) {
    specs.display_resolution = '3456x2234';
  }

  // Battery capacity based on model
  if (parsed.modelType === 'Air' && parsed.screenSize === 13.6) {
    specs.battery_mah = whToMah(52.6);
  } else if (parsed.modelType === 'Air' && parsed.screenSize === 15.3) {
    specs.battery_mah = whToMah(66.5);
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 13.6) {
    specs.battery_mah = whToMah(58.2); // 13-inch MacBook Pro
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 14.2) {
    specs.battery_mah = whToMah(70);
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 15.3) {
    specs.battery_mah = whToMah(83.6); // 15-inch MacBook Pro (Intel)
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 16.2) {
    specs.battery_mah = whToMah(100);
  }

  // Weight based on model
  if (parsed.modelType === 'Air' && parsed.screenSize === 13.6) {
    specs.weight_g = 1240;
  } else if (parsed.modelType === 'Air' && parsed.screenSize === 15.3) {
    specs.weight_g = 1510;
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 13.6) {
    specs.weight_g = 1370; // 13-inch MacBook Pro
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 14.2) {
    specs.weight_g = 1550;
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 15.3) {
    specs.weight_g = 1830; // 15-inch MacBook Pro (Intel)
  } else if (parsed.modelType === 'Pro' && parsed.screenSize === 16.2) {
    specs.weight_g = 2140;
  }

  // Display peak brightness
  if (parsed.modelType === 'Pro') {
    // XDR displays on 14" and 16" have 1600 nits peak
    if (parsed.screenSize === 14.2 || parsed.screenSize === 16.2) {
      specs.display_peak_brightness = 1600; // XDR peak brightness
    } else {
      // Older Pro models have standard brightness
      specs.display_peak_brightness = 500;
    }
  } else if (parsed.modelType === 'Air') {
    specs.display_peak_brightness = 500;
  }

  return specs;
}

async function main() {
  console.log('🍎 Starting Apple laptop specs population...\n');

  const supabase = createAdminClient();

  // Query for Apple laptops without specs
  const { data: products, error: queryError } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%laptop%')
    .ilike('brand', '%apple%')
    .limit(20);

  if (queryError) {
    console.error('Error querying products:', queryError);
    return;
  }

  if (!products || products.length === 0) {
    console.log('No Apple laptops found without specs.');
    return;
  }

  console.log(`Found ${products.length} Apple laptops to process:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    console.log(`Processing: ${product.name}`);
    console.log(`Product ID: ${product.id}`);

    try {
      // Get specs from model name
      const specs = getSpecsFromModel(product.name);

      // Prepare the record
      const specsRecord: LaptopSpecs = {
        product_id: product.id,
        ...specs,
      };

      // Delete existing specs if any
      await supabase
        .from('product_key_specs')
        .delete()
        .eq('product_id', product.id);

      // Insert into database
      const { error: insertError } = await supabase
        .from('product_key_specs')
        .insert(specsRecord);

      if (insertError) {
        console.error(`  ❌ Error inserting specs:`, insertError);
        errorCount++;
      } else {
        console.log(`  ✅ Specs inserted successfully`);
        console.log(`     Screen: ${specs.screen_size_inches}" ${specs.display_type}`);
        console.log(`     Chip: ${specs.chipset}`);
        console.log(`     RAM: ${specs.ram_gb}GB, Storage: ${specs.storage_gb}GB`);
        console.log(`     Battery: ${specs.battery_mah}mAh, Weight: ${specs.weight_g}g`);
        successCount++;
      }
    } catch (error) {
      console.error(`  ❌ Error processing product:`, error);
      errorCount++;
    }

    console.log('');

    // Rate limiting: Wait 1 second between requests
    if (products.indexOf(product) < products.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Successfully processed: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📝 Total: ${products.length}`);
}

main().catch(console.error);
