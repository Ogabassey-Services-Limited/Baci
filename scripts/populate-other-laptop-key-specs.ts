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

interface LaptopSpecs {
  product_id: string;
  screen_size_inches?: number;
  display_type?: string;
  display_resolution?: string;
  refresh_rate_hz?: number;
  chipset?: string;
  gpu?: string;
  ram_gb?: number;
  storage_gb?: number;
  battery_mah?: number;
  weight_g?: number;
  dimensions_mm?: string;
  has_headphone_jack?: boolean;
}

// Helper to convert Wh to mAh
function whToMah(wh: number, voltage = 11.4): number {
  return Math.round((wh * 1000) / voltage);
}

async function getLaptopsWithoutSpecs(): Promise<Product[]> {
  console.log('Fetching laptops without specs...');

  // First get all products matching criteria
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('category', '%laptop%')
    .or('brand.ilike.%lenovo%,brand.ilike.%msi%,brand.ilike.%asus%')
    .limit(100);

  if (productsError) {
    console.error('Error fetching products:', productsError);
    return [];
  }

  if (!products || products.length === 0) {
    console.log('No matching laptops found');
    return [];
  }

  // Get all existing specs
  const { data: existingSpecs, error: specsError } = await supabase
    .from('product_key_specs')
    .select('product_id');

  if (specsError) {
    console.error('Error fetching existing specs:', specsError);
    return products.slice(0, 20);
  }

  const existingIds = new Set(
    existingSpecs?.map(s => s.product_id) || []
  );

  const filtered = products.filter(p => !existingIds.has(p.id));
  return filtered.slice(0, 20);
}

async function insertSpecs(specs: LaptopSpecs): Promise<boolean> {
  const { error } = await supabase.from('product_key_specs').insert(specs);

  if (error) {
    console.error(`  Error inserting specs:`, error.message);
    return false;
  }

  return true;
}

async function wait(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Spec data for common laptop models
const specsDatabase: Record<string, Partial<LaptopSpecs>> = {
  // Lenovo IdeaPad Slim 3 series
  'ideapad slim 3 15irh8': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-13420H',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(47),
    weight_g: 1620,
    has_headphone_jack: true,
  },
  'ideapad slim 1 14iru9': {
    screen_size_inches: 14,
    display_type: 'TN',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i3-1315U',
    ram_gb: 8,
    storage_gb: 256,
    battery_mah: whToMah(47),
    weight_g: 1400,
    has_headphone_jack: true,
  },
  'ideapad slim 5 14ahp9': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'AMD Ryzen 7 8845HS',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(65),
    weight_g: 1460,
    has_headphone_jack: true,
  },

  // Lenovo Legion Pro series
  'legion pro 9 16irx9': {
    screen_size_inches: 16,
    display_type: 'Mini LED',
    display_resolution: '3200x2000',
    refresh_rate_hz: 165,
    chipset: 'Intel Core i9-14900HX',
    gpu: 'NVIDIA RTX 4090',
    ram_gb: 32,
    storage_gb: 1024,
    battery_mah: whToMah(99.99),
    weight_g: 2590,
    has_headphone_jack: true,
  },
  'legion pro 5 16arx8': {
    screen_size_inches: 16,
    display_type: 'IPS',
    display_resolution: '2560x1600',
    refresh_rate_hz: 240,
    chipset: 'AMD Ryzen 7 7745HX',
    gpu: 'NVIDIA RTX 4070',
    ram_gb: 16,
    storage_gb: 1024,
    battery_mah: whToMah(80),
    weight_g: 2450,
    has_headphone_jack: true,
  },
  'legion pro 7 16iax7': {
    screen_size_inches: 16,
    display_type: 'IPS',
    display_resolution: '2560x1600',
    refresh_rate_hz: 240,
    chipset: 'Intel Core i9-12900HX',
    gpu: 'NVIDIA RTX 4080',
    ram_gb: 32,
    storage_gb: 1024,
    battery_mah: whToMah(99.99),
    weight_g: 2550,
    has_headphone_jack: true,
  },

  // Lenovo ThinkPad E16 series
  'thinkpad e16 gen 2': {
    screen_size_inches: 16,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'Intel Core Ultra 5 125U',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(57),
    weight_g: 1800,
    has_headphone_jack: true,
  },

  // Lenovo ThinkBook series
  'thinkbook 16 g7': {
    screen_size_inches: 16,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'Intel Core Ultra 5 125U',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(60),
    weight_g: 1700,
    has_headphone_jack: true,
  },

  // Lenovo Yoga Slim series
  'yoga slim 7 14asn8': {
    screen_size_inches: 14,
    display_type: 'OLED',
    display_resolution: '2880x1800',
    refresh_rate_hz: 90,
    chipset: 'AMD Ryzen 7 7730U',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(73),
    weight_g: 1350,
    has_headphone_jack: true,
  },
  'yoga pro 9 16imh9': {
    screen_size_inches: 16,
    display_type: 'Mini LED',
    display_resolution: '3200x2000',
    refresh_rate_hz: 165,
    chipset: 'Intel Core Ultra 9 185H',
    gpu: 'NVIDIA RTX 4060',
    ram_gb: 32,
    storage_gb: 1024,
    battery_mah: whToMah(84),
    weight_g: 2240,
    has_headphone_jack: true,
  },

  // MSI Thin series
  'thin gf63': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'Intel Core i5-12450H',
    gpu: 'NVIDIA RTX 3050',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(51),
    weight_g: 1860,
    has_headphone_jack: true,
  },

  // MSI Titan series
  'titan gt77': {
    screen_size_inches: 17.3,
    display_type: 'IPS',
    display_resolution: '3840x2160',
    refresh_rate_hz: 144,
    chipset: 'Intel Core i9-13980HX',
    gpu: 'NVIDIA RTX 4080',
    ram_gb: 64,
    storage_gb: 2048,
    battery_mah: whToMah(99.9),
    weight_g: 3300,
    has_headphone_jack: true,
  },

  // Asus ROG Strix G18 series
  'rog strix g18': {
    screen_size_inches: 18,
    display_type: 'IPS',
    display_resolution: '2560x1600',
    refresh_rate_hz: 240,
    chipset: 'Intel Core i9-13980HX',
    gpu: 'NVIDIA RTX 4060',
    ram_gb: 16,
    storage_gb: 1024,
    battery_mah: whToMah(90),
    weight_g: 3000,
    has_headphone_jack: true,
  },
  'rog strix g16': {
    screen_size_inches: 16,
    display_type: 'IPS',
    display_resolution: '2560x1600',
    refresh_rate_hz: 240,
    chipset: 'Intel Core i9-14900HX',
    gpu: 'NVIDIA RTX 4060',
    ram_gb: 16,
    storage_gb: 1024,
    battery_mah: whToMah(90),
    weight_g: 2500,
    has_headphone_jack: true,
  },

  // Asus ROG Zephyrus G16 series
  'rog zephyrus g16': {
    screen_size_inches: 16,
    display_type: 'OLED',
    display_resolution: '2560x1600',
    refresh_rate_hz: 240,
    chipset: 'Intel Core Ultra 9 185H',
    gpu: 'NVIDIA RTX 4070',
    ram_gb: 32,
    storage_gb: 1024,
    battery_mah: whToMah(90),
    weight_g: 1850,
    has_headphone_jack: true,
  },

  // Lenovo ThinkPad series
  'thinkpad x1 carbon': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i7-1355U',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(57),
    weight_g: 1120,
    has_headphone_jack: true,
  },
  'thinkpad t14': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-1335U',
    ram_gb: 16,
    storage_gb: 256,
    battery_mah: whToMah(52.5),
    weight_g: 1380,
    has_headphone_jack: true,
  },
  'thinkpad e14': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'AMD Ryzen 5 7530U',
    ram_gb: 8,
    storage_gb: 256,
    battery_mah: whToMah(57),
    weight_g: 1410,
    has_headphone_jack: true,
  },
  'thinkpad l14': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-1235U',
    ram_gb: 8,
    storage_gb: 256,
    battery_mah: whToMah(46),
    weight_g: 1430,
    has_headphone_jack: true,
  },

  // Lenovo IdeaPad series
  'ideapad 3': {
    screen_size_inches: 15.6,
    display_type: 'TN',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-1135G7',
    ram_gb: 8,
    storage_gb: 256,
    battery_mah: whToMah(45),
    weight_g: 1650,
    has_headphone_jack: true,
  },
  'ideapad 5': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'AMD Ryzen 5 5500U',
    ram_gb: 8,
    storage_gb: 512,
    battery_mah: whToMah(56.5),
    weight_g: 1390,
    has_headphone_jack: true,
  },
  'ideapad flex': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-1235U',
    ram_gb: 8,
    storage_gb: 512,
    battery_mah: whToMah(52.5),
    weight_g: 1550,
    has_headphone_jack: true,
  },

  // Lenovo Legion gaming series
  'legion 5 pro': {
    screen_size_inches: 16,
    display_type: 'IPS',
    display_resolution: '2560x1600',
    refresh_rate_hz: 165,
    chipset: 'AMD Ryzen 7 6800H',
    gpu: 'NVIDIA RTX 3070',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(80),
    weight_g: 2450,
    has_headphone_jack: true,
  },
  'legion 5': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 120,
    chipset: 'AMD Ryzen 5 5600H',
    gpu: 'NVIDIA RTX 3060',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(60),
    weight_g: 2400,
    has_headphone_jack: true,
  },
  'legion 7': {
    screen_size_inches: 16,
    display_type: 'IPS',
    display_resolution: '2560x1600',
    refresh_rate_hz: 240,
    chipset: 'AMD Ryzen 9 6900HX',
    gpu: 'NVIDIA RTX 3080',
    ram_gb: 32,
    storage_gb: 1024,
    battery_mah: whToMah(99.99),
    weight_g: 2500,
    has_headphone_jack: true,
  },

  // Lenovo Yoga series
  'yoga 9i': {
    screen_size_inches: 14,
    display_type: 'OLED',
    display_resolution: '2880x1800',
    refresh_rate_hz: 90,
    chipset: 'Intel Core i7-1360P',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(75),
    weight_g: 1390,
    has_headphone_jack: true,
  },
  'yoga 7i': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1200',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-1240P',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(71),
    weight_g: 1450,
    has_headphone_jack: true,
  },

  // MSI Gaming series
  'katana': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'Intel Core i7-12650H',
    gpu: 'NVIDIA RTX 3060',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(53.5),
    weight_g: 2250,
    has_headphone_jack: true,
  },
  'raider': {
    screen_size_inches: 17.3,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 360,
    chipset: 'Intel Core i9-12900HK',
    gpu: 'NVIDIA RTX 3080 Ti',
    ram_gb: 32,
    storage_gb: 1024,
    battery_mah: whToMah(99.9),
    weight_g: 2900,
    has_headphone_jack: true,
  },
  'stealth': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'Intel Core i7-1185G7',
    gpu: 'NVIDIA GTX 1660 Ti',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(52),
    weight_g: 1850,
    has_headphone_jack: true,
  },
  'cyborg': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'Intel Core i7-13620H',
    gpu: 'NVIDIA RTX 4050',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(53.5),
    weight_g: 1980,
    has_headphone_jack: true,
  },
  'bravo': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'AMD Ryzen 7 5800H',
    gpu: 'AMD Radeon RX 5500M',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(51),
    weight_g: 1960,
    has_headphone_jack: true,
  },

  // Asus ROG series
  'rog zephyrus g14': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '2560x1600',
    refresh_rate_hz: 165,
    chipset: 'AMD Ryzen 9 6900HS',
    gpu: 'AMD Radeon RX 6800S',
    ram_gb: 16,
    storage_gb: 1024,
    battery_mah: whToMah(76),
    weight_g: 1650,
    has_headphone_jack: true,
  },
  'rog strix g15': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'AMD Ryzen 7 5800H',
    gpu: 'NVIDIA RTX 3060',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(90),
    weight_g: 2300,
    has_headphone_jack: true,
  },
  'rog strix scar': {
    screen_size_inches: 17.3,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 300,
    chipset: 'Intel Core i9-12900H',
    gpu: 'NVIDIA RTX 3080 Ti',
    ram_gb: 32,
    storage_gb: 1024,
    battery_mah: whToMah(90),
    weight_g: 2700,
    has_headphone_jack: true,
  },

  // Asus ZenBook series
  'zenbook 14': {
    screen_size_inches: 14,
    display_type: 'OLED',
    display_resolution: '2880x1800',
    refresh_rate_hz: 90,
    chipset: 'Intel Core i7-1260P',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(75),
    weight_g: 1390,
    has_headphone_jack: true,
  },
  'zenbook pro 15': {
    screen_size_inches: 15.6,
    display_type: 'OLED',
    display_resolution: '3840x2160',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i7-11370H',
    gpu: 'NVIDIA GTX 1650',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(96),
    weight_g: 1860,
    has_headphone_jack: true,
  },
  'zenbook flip': {
    screen_size_inches: 13.3,
    display_type: 'OLED',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-1135G7',
    ram_gb: 8,
    storage_gb: 512,
    battery_mah: whToMah(67),
    weight_g: 1300,
    has_headphone_jack: true,
  },

  // Asus VivoBook series
  'vivobook 15': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i5-1135G7',
    ram_gb: 8,
    storage_gb: 256,
    battery_mah: whToMah(42),
    weight_g: 1700,
    has_headphone_jack: true,
  },
  'vivobook 14': {
    screen_size_inches: 14,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'Intel Core i3-1115G4',
    ram_gb: 4,
    storage_gb: 256,
    battery_mah: whToMah(42),
    weight_g: 1600,
    has_headphone_jack: true,
  },
  'vivobook pro': {
    screen_size_inches: 15.6,
    display_type: 'OLED',
    display_resolution: '1920x1080',
    refresh_rate_hz: 60,
    chipset: 'AMD Ryzen 7 5800H',
    gpu: 'NVIDIA GTX 1650',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(70),
    weight_g: 1800,
    has_headphone_jack: true,
  },

  // Asus TUF series
  'tuf gaming f15': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'Intel Core i5-11400H',
    gpu: 'NVIDIA RTX 3050',
    ram_gb: 8,
    storage_gb: 512,
    battery_mah: whToMah(48),
    weight_g: 2300,
    has_headphone_jack: true,
  },
  'tuf gaming a15': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'AMD Ryzen 7 5800H',
    gpu: 'NVIDIA RTX 3060',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(90),
    weight_g: 2300,
    has_headphone_jack: true,
  },
  'tuf dash': {
    screen_size_inches: 15.6,
    display_type: 'IPS',
    display_resolution: '1920x1080',
    refresh_rate_hz: 144,
    chipset: 'Intel Core i7-11370H',
    gpu: 'NVIDIA RTX 3060',
    ram_gb: 16,
    storage_gb: 512,
    battery_mah: whToMah(76),
    weight_g: 2000,
    has_headphone_jack: true,
  },
};

function findMatchingSpecs(productName: string): Partial<LaptopSpecs> | null {
  const lowerName = productName.toLowerCase();

  // Try to find exact match first
  for (const [model, specs] of Object.entries(specsDatabase)) {
    if (lowerName.includes(model)) {
      return specs;
    }
  }

  return null;
}

async function processLaptops() {
  console.log('=== Other Laptop Brands Key Specs Population ===\n');
  console.log('Target: Lenovo, MSI, Asus laptops\n');

  const products = await getLaptopsWithoutSpecs();

  if (products.length === 0) {
    console.log('No laptops found without specs!');
    return;
  }

  console.log(`Found ${products.length} laptops to process:\n`);
  products.forEach((p, i) => {
    console.log(`${i + 1}. [${p.brand}] ${p.name}`);
  });

  console.log('\n=== Processing ===\n');

  let successCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    console.log(`\n[${successCount + skippedCount + 1}/${products.length}] ${product.brand} - ${product.name}`);

    const matchedSpecs = findMatchingSpecs(product.name);

    if (matchedSpecs) {
      const specs: LaptopSpecs = {
        product_id: product.id,
        ...matchedSpecs,
      };

      console.log('  ✓ Found specs match!');
      console.log(`    Screen: ${specs.screen_size_inches}" ${specs.display_type} ${specs.display_resolution} @ ${specs.refresh_rate_hz}Hz`);
      console.log(`    CPU: ${specs.chipset}`);
      if (specs.gpu) console.log(`    GPU: ${specs.gpu}`);
      console.log(`    Memory: ${specs.ram_gb}GB RAM | ${specs.storage_gb}GB Storage`);
      console.log(`    Battery: ${specs.battery_mah}mAh | Weight: ${specs.weight_g}g`);

      const inserted = await insertSpecs(specs);
      if (inserted) {
        console.log('  ✅ Successfully inserted to database');
        successCount++;
      }
    } else {
      console.log('  ⚠️  No matching specs found in database');
      console.log('     (Model not in specs database - needs manual research)');
      skippedCount++;
    }

    // Rate limiting - wait 3 seconds between requests
    if (successCount + skippedCount < products.length) {
      await wait(3);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total products processed: ${products.length}`);
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`⚠️  Skipped (no match): ${skippedCount}`);

  if (skippedCount > 0) {
    console.log('\nNote: Skipped products need manual research from Notebookcheck.net or similar sources');
  }
}

processLaptops().catch(console.error);
